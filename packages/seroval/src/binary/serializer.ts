import type { SerovalTemporalValue } from '../core/base-primitives';
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
  SerovalTemporalType,
  type TypedArrayValue,
} from '../core/constants';
import {
  SerovalDepthLimitError,
  SerovalUnsupportedTypeError,
} from '../core/errors';
import { isLiveStream, type LiveStream } from '../core/live-stream';
import { OpaqueReference } from '../core/opaque-reference';
import type { PluginWithBinaryMode } from '../core/plugin';
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

// Same cap as the ArrayBuffer deserialization limit (MAX_BASE64_LENGTH).
const MAX_TYPED_ARRAY_LENGTH = 1_000_000;

export type Cleanup = () => void;

export interface BinarySerializerPluginContext {
  /** Registers a function that runs once serialization ends or is aborted. */
  addCleanup(cleanup: Cleanup): void;
  /**
   * Turns an async iterable into a stream that the serializer can send. The
   * serializer stops pulling from the source and calls its `return` method
   * when serialization ends or is aborted.
   */
  streamSource<T>(source: AsyncIterable<T>): Stream<T>;
}

/**
 * Receives each serialized chunk. Returning a promise holds back the
 * acceptance of the live stream event behind the chunk until the promise
 * settles. Other chunks are not delayed.
 */
export type BinarySerializeCallback = (
  bytes: Uint8Array,
) => void | PromiseLike<void>;

export interface SerializerContext {
  alive: boolean;
  pending: number;
  depthLimit: number;
  refs: Map<unknown, Uint8Array>;
  features: number;
  plugins?: PluginWithBinaryMode<any, any, any>[];
  onSerialize: BinarySerializeCallback;
  onDone(): void;
  onError(error: unknown): void;
  cleanups: Cleanup[];

  pluginContext: BinarySerializerPluginContext;
}

export interface SerializerContextOptions {
  features?: number;
  disabledFeatures?: number;
  depthLimit?: number;
  refs: Map<unknown, Uint8Array>;
  plugins?: PluginWithBinaryMode<any, any, any>[];
  onSerialize: BinarySerializeCallback;
  onDone(): void;
  onError(error: unknown): void;
}

function registerCleanup(this: (() => void)[], cleanup: Cleanup) {
  this.push(cleanup);
}

function createStreamSource<T>(
  this: (() => void)[],
  source: AsyncIterable<T>,
): Stream<T> {
  return createStreamFromAsyncIterable(source, this);
}

// Runs every cleanup even if one throws, and returns the first error.
function runCleanups(ctx: SerializerContext): { error: unknown } | undefined {
  const cleanups = ctx.cleanups;
  ctx.cleanups = [];
  let failure: { error: unknown } | undefined;
  for (let i = 0, len = cleanups.length; i < len; i++) {
    try {
      cleanups[i]();
    } catch (error) {
      failure ??= { error };
    }
  }
  return failure;
}

export function createSerializerContext(
  options: SerializerContextOptions,
): SerializerContext {
  const cleanups: Cleanup[] = [];

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
    cleanups,

    pluginContext: {
      addCleanup: registerCleanup.bind(cleanups),
      streamSource: createStreamSource.bind(cleanups) as <T>(
        source: AsyncIterable<T>,
      ) => Stream<T>,
    },
  };
}

function pushPendingState(ctx: SerializerContext): void {
  ctx.pending++;
}

function popPendingState(ctx: SerializerContext): void {
  if (--ctx.pending <= 0) {
    finishSerialize(ctx);
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

function onSerialize(
  ctx: SerializerContext,
  bytes: SerovalNode,
): void | PromiseLike<void> {
  return ctx.onSerialize(mergeBytes(bytes));
}

function serializePending(
  ctx: SerializerContext,
  source: Uint8Array,
  amount: number,
): void {
  onSerialize(ctx, [SerovalBinaryType.Pending, source, encodeUint(amount)]);
}

// `refs` is keyed by the value being serialized, so a constant must be keyed
// by its runtime value and never by its `SerovalConstant` tag, otherwise the
// numbers 0-7 would collide with the tags of `null`, `true`, `NaN` and friends.
// `-0` gets a sentinel because a Map cannot tell `-0` and `0` apart.
const NEG_ZERO_KEY = {};

function serializeConstant(
  ctx: SerializerContext,
  key: unknown,
  value: SerovalConstant,
) {
  const id = createID(ctx, key);
  onSerialize(ctx, [SerovalBinaryType.Constant, id, value]);
  return id;
}

function serializeNumber(ctx: SerializerContext, value: number) {
  switch (value) {
    case Number.POSITIVE_INFINITY:
      return serializeConstant(ctx, value, SerovalConstant.Inf);
    case Number.NEGATIVE_INFINITY:
      return serializeConstant(ctx, value, SerovalConstant.NegInf);
  }
  if (value !== value) {
    return serializeConstant(ctx, value, SerovalConstant.Nan);
  }
  if (Object.is(value, -0)) {
    return serializeConstant(ctx, NEG_ZERO_KEY, SerovalConstant.NegZero);
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

  let pending = 0;
  for (let i = 0; i < len; i++) {
    if (i in value) {
      onSerialize(ctx, [
        SerovalBinaryType.ArrayAssign,
        id,
        encodeUint(i),
        serialize(ctx, value[i]),
      ]);
      pending++;
    }
  }
  serializePending(ctx, id, pending);
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
  onSerialize(ctx, [SerovalBinaryType.Stream, id, 0]);

  const prevDepth = CURRENT_DEPTH;

  const unsubscribe = current.on({
    next: serializeStreamNext.bind(null, ctx, prevDepth, id),
    throw: serializeStreamThrow.bind(null, ctx, prevDepth, id),
    return: serializeStreamReturn.bind(null, ctx, prevDepth, id),
  });
  // A stream that ended while subscribing has already released its slot.
  if (ctx.alive) {
    ctx.cleanups.push(unsubscribe);
  }
  return id;
}

type LiveEventType =
  | SerovalBinaryType.StreamNext
  | SerovalBinaryType.StreamThrow
  | SerovalBinaryType.StreamReturn;

// Sends one live stream event. The event is accepted, which lets the producer
// continue, only after `onSerialize` has accepted the chunk. Returns the error
// that stopped the stream, if any.
function serializeLiveEvent(
  ctx: SerializerContext,
  depth: number,
  id: Uint8Array,
  type: LiveEventType,
  value: unknown,
  accept: () => void,
): unknown {
  if (!ctx.alive) {
    return NIL;
  }
  let serialized: Uint8Array;
  try {
    serialized = serializeWithDepth(ctx, depth, value);
  } catch (error) {
    ctx.onError(error);
    return error;
  }
  const result = onSerialize(ctx, [type, id, serialized]);
  if (result && typeof result.then === 'function') {
    result.then(accept, (error: unknown) => {
      ctx.onError(error);
    });
  } else {
    accept();
  }
  return NIL;
}

function serializeLiveStream(
  ctx: SerializerContext,
  current: LiveStream<unknown>,
) {
  const id = createID(ctx, current);
  pushPendingState(ctx);
  onSerialize(ctx, [SerovalBinaryType.Stream, id, 1]);

  const depth = CURRENT_DEPTH;

  const cancel = current.pump({
    next: serializeLiveEvent.bind(
      null,
      ctx,
      depth,
      id,
      SerovalBinaryType.StreamNext,
    ),
    throw: serializeLiveEvent.bind(
      null,
      ctx,
      depth,
      id,
      SerovalBinaryType.StreamThrow,
    ),
    return: serializeLiveEvent.bind(
      null,
      ctx,
      depth,
      id,
      SerovalBinaryType.StreamReturn,
    ),
    done() {
      popPendingState(ctx);
    },
    error(reason) {
      if (ctx.alive) {
        ctx.onError(reason);
        popPendingState(ctx);
      }
    },
  });
  ctx.cleanups.push(() => cancel());
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
  const length = value.v.length;
  for (let i = 0; i < length; i++) {
    onSerialize(ctx, [
      SerovalBinaryType.SequencePush,
      id,
      serialize(ctx, value.v[i]),
    ]);
  }
  serializePending(ctx, id, length);
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
  let pending = entries.length;
  for (let i = 0; i < pending; i++) {
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
    pending++;
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
          ctx.cleanups,
        ),
      ),
    ]);
    pending++;
  }
  if (SYM_TO_STRING_TAG in properties) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, SYM_TO_STRING_TAG),
      serialize(ctx, properties[SYM_TO_STRING_TAG]),
    ]);
    pending++;
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    onSerialize(ctx, [
      SerovalBinaryType.ObjectAssign,
      id,
      serialize(ctx, SYM_IS_CONCAT_SPREADABLE),
      serialize(ctx, properties[SYM_IS_CONCAT_SPREADABLE]),
    ]);
    pending++;
  }

  serializePending(ctx, id, pending);
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
  serializeErrorProperties(ctx, id, value);
  return id;
}

// Errors always end with a `Pending` node, even with no extra properties, so
// the decoder can tell when the error is complete.
function serializeErrorProperties(
  ctx: SerializerContext,
  id: Uint8Array,
  value: Error,
): void {
  const properties = getErrorOptions(value, ctx.features);
  if (properties) {
    serializeProperties(ctx, id, properties);
  } else {
    serializePending(ctx, id, 0);
  }
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
  if (value.length > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalUnsupportedTypeError(value);
  }
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.TypedArray,
    id,
    getTypedArrayTag(value),
    serialize(ctx, value.buffer),
    encodeUint(value.byteOffset),
    encodeUint(value.length),
  ]);
  return id;
}

function serializeBigIntTypedArray(
  ctx: SerializerContext,
  value: BigIntTypedArrayValue,
) {
  if (value.length > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalUnsupportedTypeError(value);
  }
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.BigIntTypedArray,
    id,
    getBigIntTypedArrayTag(value),
    serialize(ctx, value.buffer),
    encodeUint(value.byteOffset),
    encodeUint(value.length),
  ]);
  return id;
}

function serializeDataView(ctx: SerializerContext, value: DataView) {
  if (value.byteLength > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalUnsupportedTypeError(value);
  }
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.DataView,
    id,
    serialize(ctx, value.buffer),
    encodeUint(value.byteOffset),
    encodeUint(value.byteLength),
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
  serializePending(ctx, id, value.size);
  return id;
}

function serializeSet(ctx: SerializerContext, value: Set<unknown>) {
  const id = createID(ctx, value);
  onSerialize(ctx, [SerovalBinaryType.Set, id]);
  for (const key of value.keys()) {
    onSerialize(ctx, [SerovalBinaryType.SetAdd, id, serialize(ctx, key)]);
  }
  serializePending(ctx, id, value.size);
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
  serializeErrorProperties(ctx, id, value);
  return id;
}

function serializeTemporal(
  ctx: SerializerContext,
  value: SerovalTemporalValue,
  type: SerovalTemporalType,
) {
  const id = createID(ctx, value);
  onSerialize(ctx, [
    SerovalBinaryType.Temporal,
    id,
    type,
    serialize(ctx, value.toString()),
  ]);
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
  if (currentFeatures & Feature.Temporal && typeof Temporal !== 'undefined') {
    switch (currentClass) {
      case Temporal.Duration:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.Duration,
          SerovalTemporalType.Duration,
        );
      case Temporal.Instant:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.Instant,
          SerovalTemporalType.Instant,
        );
      case Temporal.PlainDate:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.PlainDate,
          SerovalTemporalType.PlainDate,
        );
      case Temporal.PlainDateTime:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.PlainDateTime,
          SerovalTemporalType.PlainDateTime,
        );
      case Temporal.PlainMonthDay:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.PlainMonthDay,
          SerovalTemporalType.PlainMonthDay,
        );
      case Temporal.PlainTime:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.PlainTime,
          SerovalTemporalType.PlainTime,
        );
      case Temporal.PlainYearMonth:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.PlainYearMonth,
          SerovalTemporalType.PlainYearMonth,
        );
      case Temporal.ZonedDateTime:
        return serializeTemporal(
          ctx,
          current as unknown as Temporal.ZonedDateTime,
          SerovalTemporalType.ZonedDateTime,
        );
    }
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
          serialize(ctx, current.binary.serialize(value, ctx.pluginContext)),
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
      if (isLiveStream(value)) {
        return serializeLiveStream(ctx, value as unknown as LiveStream<unknown>);
      }
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
  // `-0` must not reuse the id of `0`: both are the same Map key.
  const currentID = Object.is(current, -0) ? NIL : ctx.refs.get(current);
  if (currentID != null) {
    return currentID;
  }
  switch (typeof current) {
    case 'boolean':
      return serializeConstant(
        ctx,
        current,
        current ? SerovalConstant.True : SerovalConstant.False,
      );
    case 'undefined':
      return serializeConstant(ctx, current, SerovalConstant.Undefined);
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
      return serializeConstant(ctx, current, SerovalConstant.Null);
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
  // Hold a pending slot for the duration of the root traversal: a source that
  // completes synchronously (an already-finished Stream, for example) would
  // otherwise end the serialization before the root node is written.
  pushPendingState(ctx);
  const serialized = serializeWithError(ctx, 0, value);
  if (serialized) {
    onSerialize(ctx, [SerovalBinaryType.Root, serialized]);

    popPendingState(ctx);
  } else {
    // The root failed and was reported through `onError`. Sources that already
    // started would otherwise keep running with no root to attach to.
    stopSerialize(ctx);
  }
}

// Serialization finished normally: every pending value has settled.
function finishSerialize(ctx: SerializerContext): void {
  if (ctx.alive) {
    ctx.alive = false;
    const failure = runCleanups(ctx);
    if (failure) {
      ctx.onError(failure.error);
    } else {
      ctx.onDone();
    }
  }
}

// Serialization ended early. Sources are stopped and `onDone` is not called.
// A cleanup error is not reported, so it cannot hide the error that caused
// the stop.
function stopSerialize(ctx: SerializerContext): void {
  if (ctx.alive) {
    ctx.alive = false;
    runCleanups(ctx);
  }
}

/**
 * Aborts serialization. Pending sources are stopped and their cleanups run.
 * `onDone` is not called. A cleanup error is reported through `onError`.
 */
export function endSerialize(ctx: SerializerContext): void {
  if (ctx.alive) {
    ctx.alive = false;
    const failure = runCleanups(ctx);
    if (failure) {
      ctx.onError(failure.error);
    }
  }
}
