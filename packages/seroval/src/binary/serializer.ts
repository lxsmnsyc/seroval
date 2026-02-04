import { ALL_ENABLED, Feature } from '../core/compat';
import {
  type BigIntTypedArrayValue,
  DEFAULT_DEPTH_LIMIT,
  getBigIntTypedArrayTag,
  getTypedArrayTag,
  INV_SYMBOL_REF,
  isWellKnownSymbol,
  NIL,
  SerovalConstant,
  type TypedArrayValue,
} from '../core/constants';
import {
  SerovalDepthLimitError,
  SerovalUnsupportedTypeError,
} from '../core/errors';
import { OpaqueReference } from '../core/opaque-reference';
import {
  createSequenceFromIterable,
  isSequence,
  type Sequence,
} from '../core/sequence';
import {
  createStreamFromAsyncIterable,
  isStream,
  type Stream,
} from '../core/stream';
import {
  SYM_ASYNC_ITERATOR,
  SYM_IS_CONCAT_SPREADABLE,
  SYM_ITERATOR,
  SYM_TO_STRING_TAG,
} from '../core/symbols';
import { getErrorConstructor, getErrorOptions } from '../core/utils/error';
import { getObjectFlag } from '../core/utils/get-object-flag';
import {
  encodeBigint,
  encodeInt,
  encodeNumber,
  encodeString,
  encodeUint,
  mergeBytes,
} from './encoder';
import {
  SerovalBinaryType,
  SerovalEndianness,
  type SerovalNode,
} from './nodes';
import type { Plugin } from './plugin';

export interface SerializerContext {
  alive: boolean;
  pending: number;
  depthLimit: number;
  refs: Map<unknown, Uint8Array>;
  features: number;
  plugins?: Plugin<any, any>[];
  onSerialize(bytes: Uint8Array): void;
  onDone(): void;
  onError(error: unknown): void;
}

export interface SerializerContextOptions {
  features?: number;
  disabledFeatures?: number;
  depthLimit?: number;
  refs: Map<unknown, Uint8Array>;
  plugins?: Plugin<any, any>[];
  onSerialize(bytes: Uint8Array): void;
  onDone(): void;
  onError(error: unknown): void;
}

export function createSerializerContext(
  options: SerializerContextOptions,
): SerializerContext {
  return {
    alive: true,
    pending: 0,
    refs: options.refs ?? new Map(),
    depthLimit: options.depthLimit ?? DEFAULT_DEPTH_LIMIT,
    features: options.features ?? ALL_ENABLED ^ (options.disabledFeatures || 0),
    onSerialize: options.onSerialize,
    onDone: options.onDone,
    onError: options.onError,
    plugins: options.plugins,
  };
}

function pushPendingState(ctx: SerializerContext): void {
  ctx.pending++;
}

function popPendingState(ctx: SerializerContext): void {
  if (--ctx.pending <= 0) {
    endSerialize(ctx);
  }
}

let CURRENT_DEPTH = 0;

function serializeWithDepth<T>(
  ctx: SerializerContext,
  depth: number,
  current: T,
): Uint8Array {
  const prevDepth = CURRENT_DEPTH;
  CURRENT_DEPTH = depth;
  try {
    return serialize(ctx, current);
  } finally {
    CURRENT_DEPTH = prevDepth;
  }
}

function serializeWithError<T>(
  ctx: SerializerContext,
  depth: number,
  current: T,
): Uint8Array | undefined {
  try {
    return serializeWithDepth(ctx, depth, current);
  } catch (err) {
    ctx.onError(err);
    return NIL;
  }
}

function createID(ctx: SerializerContext, value: unknown): Uint8Array {
  const id = encodeUint(ctx.refs.size + 1);
  ctx.refs.set(value, id);
  return id;
}

function onSerialize(ctx: SerializerContext, bytes: SerovalNode): void {
  ctx.onSerialize(mergeBytes(bytes));
}

function serializeConstant(ctx: SerializerContext, value: SerovalConstant) {
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Constant, id, value]);
  return id;
}

function serializeNumber(ctx: SerializerContext, value: number) {
  switch (value) {
    case Number.POSITIVE_INFINITY:
      return serializeConstant(ctx, SerovalConstant.Inf);
    case Number.NEGATIVE_INFINITY:
      return serializeConstant(ctx, SerovalConstant.NegInf);
  }
  if (value !== value) {
    return serializeConstant(ctx, SerovalConstant.Nan);
  }
  if (Object.is(value, -0)) {
    return serializeConstant(ctx, SerovalConstant.NegZero);
  }
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Number, id, encodeNumber(value)]);
  return id;
}

function serializeString(ctx: SerializerContext, value: string) {
  const id = createID(ctx, value);
  const bytes = encodeString(value);
  onSerialize(ctx, [
    SerovalBinaryType.String,
    id,
    encodeUint(bytes.length),
    bytes,
  ]);
  return id;
}

function serializeBigInt(ctx: SerializerContext, value: bigint) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.BigInt,
    id,
    value < 0 ? 1 : 0,
    serialize(ctx, encodeBigint(value < 0 ? -value : value)),
  ]);
  return id;
}

function serializeWellKnownSymbol(ctx: SerializerContext, value: symbol) {
  if (isWellKnownSymbol(value)) {
    const id = createID(ctx, value);
    onSerialize(ctx, [SerovalBinaryType.WKSymbol, id, INV_SYMBOL_REF[value]]);
    return id;
  }
  // TODO allow plugins to support symbols?
  throw new SerovalUnsupportedTypeError(value);
}

function serializeArray(ctx: SerializerContext, value: unknown[]) {
  const id = createID(ctx, value);
  const len = value.length;
  onSerialize(ctx, [SerovalBinaryType.Array, id, encodeUint(len)]);
  for (let i = 0; i < len; i++) {
    if (i in value) {
      onSerialize(ctx, [
        SerovalBinaryType.ArrayAssign,
        id,
        encodeUint(i),
        serialize(ctx, value[i]),
      ]);
    }
  }
  onSerialize(ctx, [SerovalBinaryType.ObjectFlag, id, getObjectFlag(value)]);
  return id;
}

function serializeStreamNext(
  ctx: SerializerContext,
  depth: number,
  id: Uint8Array,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      onSerialize(ctx, [SerovalBinaryType.StreamNext, id, serialized]);
    }
  }
}

function serializeStreamThrow(
  ctx: SerializerContext,
  depth: number,
  id: Uint8Array,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      onSerialize(ctx, [SerovalBinaryType.StreamThrow, id, serialized]);
    }
  }
  popPendingState(ctx);
}

function serializeStreamReturn(
  ctx: SerializerContext,
  depth: number,
  id: Uint8Array,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      onSerialize(ctx, [SerovalBinaryType.StreamReturn, id, serialized]);
    }
  }
  popPendingState(ctx);
}

function serializeStream(ctx: SerializerContext, current: Stream<unknown>) {
  const id = createID(ctx, current);
  pushPendingState(ctx);
  onSerialize(ctx, [SerovalBinaryType.Stream, id]);

  const prevDepth = CURRENT_DEPTH;

  current.on({
    next: serializeStreamNext.bind(null, ctx, prevDepth, id),
    throw: serializeStreamThrow.bind(null, ctx, prevDepth, id),
    return: serializeStreamReturn.bind(null, ctx, prevDepth, id),
  });
  return id;
}

function serializeSequence(ctx: SerializerContext, value: Sequence) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.Sequence,
    id,
    encodeInt(value.t),
    encodeInt(value.d),
  ]);
  for (let i = 0, len = value.v.length; i < len; i++) {
    onSerialize(ctx, [
      SerovalBinaryType.SequencePush,
      id,
      serialize(ctx, value.v[i]),
    ]);
  }
  return id;
}

function serializeIterator(ctx: SerializerContext, sequence: Sequence) {
  const id = createID(ctx, {});
  onSerialize(ctx, [SerovalBinaryType.Iterator, id, serialize(ctx, sequence)]);
  return id;
}

function serializeAsyncIterator(
  ctx: SerializerContext,
  stream: Stream<unknown>,
) {
  const id = createID(ctx, {});
  onSerialize(ctx, [
    SerovalBinaryType.AsyncIterator,
    id,
    serialize(ctx, stream),
  ]);
  return id;
}

function serializeProperties(
  ctx: SerializerContext,
  id: Uint8Array,
  properties: object,
) {
  const entries = Object.entries(properties);
  for (let i = 0, len = entries.length; i < len; i++) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, entries[i][0]),
      serialize(ctx, entries[i][1]),
    ]);
  }

  // Check special properties, symbols in this case
  if (SYM_ITERATOR in properties) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, SYM_ITERATOR),
      serializeIterator(
        ctx,
        createSequenceFromIterable(properties as unknown as Iterable<unknown>),
      ),
    ]);
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, SYM_ASYNC_ITERATOR),
      serializeAsyncIterator(
        ctx,
        createStreamFromAsyncIterable(
          properties as unknown as AsyncIterable<unknown>,
        ),
      ),
    ]);
  }
  if (SYM_TO_STRING_TAG in properties) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, SYM_TO_STRING_TAG),
      serialize(ctx, properties[SYM_TO_STRING_TAG]),
    ]);
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, SYM_IS_CONCAT_SPREADABLE),
      serialize(ctx, properties[SYM_IS_CONCAT_SPREADABLE]),
    ]);
  }
}

function serializePlainObject(
  ctx: SerializerContext,
  value: object,
  empty: boolean,
) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    empty ? SerovalBinaryType.NullConstructor : SerovalBinaryType.Object,
    id,
  ]);
  serializeProperties(ctx, id, value);
  onSerialize(ctx, [SerovalBinaryType.ObjectFlag, id, getObjectFlag(value)]);
  return id;
}

function serializeDate(ctx: SerializerContext, value: Date) {
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Date, id, encodeNumber(value.getTime())]);
  return id;
}

function serializeError(ctx: SerializerContext, value: Error) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.Error,
    id,
    getErrorConstructor(value),
    serialize(ctx, value.message),
  ]);
  const properties = getErrorOptions(value, ctx.features);
  if (properties) {
    serializeProperties(ctx, id, properties);
  }
  return id;
}

function serializeBoxed(ctx: SerializerContext, value: object) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.Boxed,
    id,
    serialize(ctx, value.valueOf()),
  ]);
  return id;
}

function serializeArrayBuffer(ctx: SerializerContext, value: ArrayBuffer) {
  const id = createID(ctx, value);
  const arr = new Uint8Array(value);
  onSerialize(ctx, [
    SerovalBinaryType.ArrayBuffer,
    id,
    encodeUint(arr.length),
    arr,
  ]);
  return id;
}

function serializeTypedArray(ctx: SerializerContext, value: TypedArrayValue) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.TypedArray,
    id,
    getTypedArrayTag(value),
    encodeUint(value.byteOffset),
    encodeUint(value.byteLength),
    serialize(ctx, value.buffer),
  ]);
  return id;
}

function serializeBigIntTypedArray(
  ctx: SerializerContext,
  value: BigIntTypedArrayValue,
) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.BigIntTypedArray,
    id,
    getBigIntTypedArrayTag(value),
    encodeUint(value.byteOffset),
    encodeUint(value.byteLength),
    serialize(ctx, value.buffer),
  ]);
  return id;
}

function serializeDataView(ctx: SerializerContext, value: DataView) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.DataView,
    id,
    encodeUint(value.byteOffset),
    encodeUint(value.byteLength),
    serialize(ctx, value.buffer),
  ]);
  return id;
}

function serializeMap(ctx: SerializerContext, value: Map<unknown, unknown>) {
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Map, id]);
  for (const [key, val] of value.entries()) {
    onSerialize(ctx, [
      SerovalBinaryType.MapSet,
      id,
      serialize(ctx, key),
      serialize(ctx, val),
    ]);
  }
  return id;
}

function serializeSet(ctx: SerializerContext, value: Set<unknown>) {
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Set, id]);
  for (const key of value.keys()) {
    onSerialize(ctx, [SerovalBinaryType.SetAdd, id, serialize(ctx, key)]);
  }
  return id;
}

function serializePromiseSuccess(
  ctx: SerializerContext,
  depth: number,
  id: Uint8Array,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      onSerialize(ctx, [SerovalBinaryType.PromiseSuccess, id, serialized]);
    }
  }
  popPendingState(ctx);
}

function serializePromiseFailure(
  ctx: SerializerContext,
  depth: number,
  id: Uint8Array,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      onSerialize(ctx, [SerovalBinaryType.PromiseFailure, id, serialized]);
    }
  }
  popPendingState(ctx);
}

function serializePromise(ctx: SerializerContext, value: Promise<unknown>) {
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Promise, id]);
  const prevDepth = CURRENT_DEPTH;
  pushPendingState(ctx);
  value.then(
    serializePromiseSuccess.bind(null, ctx, prevDepth, id),
    serializePromiseFailure.bind(null, ctx, prevDepth, id),
  );
  return id;
}

function serializeRegExp(ctx: SerializerContext, value: RegExp) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.RegExp,
    id,
    serialize(ctx, value.source),
    serialize(ctx, value.flags),
  ]);
  return id;
}

function serializeAggregateError(
  ctx: SerializerContext,
  value: AggregateError,
) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.AggregateError,
    id,
    serialize(ctx, value.message),
  ]);
  const properties = getErrorOptions(value, ctx.features);
  if (properties) {
    serializeProperties(ctx, id, properties);
  }
  return id;
}

function serializeObjectPhase2(
  ctx: SerializerContext,
  current: object,
  currentClass: unknown,
): Uint8Array {
  switch (currentClass) {
    case Object:
      return serializePlainObject(
        ctx,
        current as Record<string, unknown>,
        false,
      );
    case NIL:
      return serializePlainObject(
        ctx,
        current as Record<string, unknown>,
        true,
      );
    case Date:
      return serializeDate(ctx, current as Date);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return serializeError(ctx, current as unknown as Error);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return serializeBoxed(ctx, current);
    case ArrayBuffer:
      return serializeArrayBuffer(ctx, current as unknown as ArrayBuffer);
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return serializeTypedArray(ctx, current as unknown as TypedArrayValue);
    case DataView:
      return serializeDataView(ctx, current as unknown as DataView);
    case Map:
      return serializeMap(ctx, current as unknown as Map<unknown, unknown>);
    case Set:
      return serializeSet(ctx, current as unknown as Set<unknown>);
    default:
      break;
  }
  // Promises
  if (currentClass === Promise || current instanceof Promise) {
    return serializePromise(ctx, current as unknown as Promise<unknown>);
  }
  const currentFeatures = ctx.features;
  if (currentFeatures & Feature.RegExp && currentClass === RegExp) {
    return serializeRegExp(ctx, current as unknown as RegExp);
  }
  // BigInt Typed Arrays
  if (currentFeatures & Feature.BigIntTypedArray) {
    switch (currentClass) {
      case BigInt64Array:
      case BigUint64Array:
        return serializeBigIntTypedArray(
          ctx,
          current as unknown as BigIntTypedArrayValue,
        );
      default:
        break;
    }
  }
  if (
    currentFeatures & Feature.AggregateError &&
    typeof AggregateError !== 'undefined' &&
    (currentClass === AggregateError || current instanceof AggregateError)
  ) {
    return serializeAggregateError(ctx, current as unknown as AggregateError);
  }
  // Slow path. We only need to handle Errors and Iterators
  // since they have very broad implementations.
  if (current instanceof Error) {
    return serializeError(ctx, current);
  }
  // Generator functions don't have a global constructor
  // despite existing
  if (SYM_ITERATOR in current || SYM_ASYNC_ITERATOR in current) {
    return serializePlainObject(ctx, current, !!currentClass);
  }
  throw new SerovalUnsupportedTypeError(current);
}

function serializePlugin(ctx: SerializerContext, value: object) {
  const plugins = ctx.plugins;
  if (plugins) {
    for (let i = 0, len = plugins.length; i < len; i++) {
      const current = plugins[i];
      if (current.test(value)) {
        const id = createID(ctx, value);
        onSerialize(ctx, [
          SerovalBinaryType.Plugin,
          id,
          serialize(ctx, current.tag),
          serialize(ctx, current.serialize(value)),
        ]);
        return id;
      }
    }
  }
  return undefined;
}

function serializeObject(ctx: SerializerContext, value: object): Uint8Array {
  const prevDepth = CURRENT_DEPTH;
  CURRENT_DEPTH += 1;
  try {
    if (Array.isArray(value)) {
      return serializeArray(ctx, value);
    }
    if (isStream(value)) {
      return serializeStream(ctx, value);
    }
    if (isSequence(value)) {
      return serializeSequence(ctx, value);
    }
    const currentClass = value.constructor;
    if (currentClass === OpaqueReference) {
      return serialize(
        ctx,
        (value as OpaqueReference<unknown, unknown>).replacement,
      );
    }
    const serialized = serializePlugin(ctx, value);
    if (serialized != null) {
      return serialized;
    }
    return serializeObjectPhase2(ctx, value, currentClass);
  } finally {
    CURRENT_DEPTH = prevDepth;
  }
}

function serializeFunction(ctx: SerializerContext, current: Function) {
  const plugin = serializePlugin(ctx, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

function serialize<T>(ctx: SerializerContext, current: T): Uint8Array {
  if (CURRENT_DEPTH >= ctx.depthLimit) {
    throw new SerovalDepthLimitError(ctx.depthLimit);
  }
  const currentID = ctx.refs.get(current);
  if (currentID != null) {
    return currentID;
  }
  switch (typeof current) {
    case 'boolean':
      return serializeConstant(
        ctx,
        current ? SerovalConstant.True : SerovalConstant.False,
      );
    case 'undefined':
      return serializeConstant(ctx, SerovalConstant.Undefined);
    case 'number':
      return serializeNumber(ctx, current);
    case 'string':
      return serializeString(ctx, current as string);
    case 'bigint':
      return serializeBigInt(ctx, current as bigint);
    case 'object': {
      if (current) {
        return serializeObject(ctx, current);
      }
      return serializeConstant(ctx, SerovalConstant.Null);
    }
    case 'symbol':
      return serializeWellKnownSymbol(ctx, current);
    case 'function': {
      return serializeFunction(ctx, current);
    }
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

function getEndianness() {
  const encoded = encodeUint(1);
  if (encoded[0] === 1) {
    return SerovalEndianness.LE;
  }
  return SerovalEndianness.BE;
}

const ENDIANNESS = /* @__PURE__ */ getEndianness();

export function startSerialize<T>(ctx: SerializerContext, value: T) {
  onSerialize(ctx, [SerovalBinaryType.Preamble, ENDIANNESS]);
  const serialized = serializeWithError(ctx, 0, value);
  if (serialized) {
    onSerialize(ctx, [SerovalBinaryType.Root, serialized]);

    if (ctx.pending <= 0) {
      endSerialize(ctx);
    }
  }
}

export function endSerialize(ctx: SerializerContext) {
  if (ctx.alive) {
    ctx.onDone();
    ctx.alive = false;
  }
}
