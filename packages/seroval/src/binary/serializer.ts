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
import { getReferenceID } from '../core/reference';
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
  type ByteWriter,
  createByteWriter,
  encodeBigint,
  flushBytes,
  NATIVE_LITTLE_ENDIAN,
  reserveBytes,
  writeByte,
  writeBytes,
  writeInt,
  writeNumber,
  writeString,
  writeUint,
} from './encoder';
import { SerovalBinaryType, SerovalEndianness } from './nodes';

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
  refs: Map<unknown, number>;
  features: number;
  plugins?: PluginWithBinaryMode<any, any, any>[];
  onSerialize: BinarySerializeCallback;
  onDone(): void;
  onError(error: unknown): void;
  cleanups: Cleanup[];
  // Nodes written since the last flush.
  writer: ByteWriter;

  pluginContext: BinarySerializerPluginContext;
}

export interface SerializerContextOptions {
  features?: number;
  disabledFeatures?: number;
  depthLimit?: number;
  refs: Map<unknown, number>;
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
    writer: createByteWriter(),

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
): number {
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
): number | undefined {
  try {
    return serializeWithDepth(ctx, depth, current);
  } catch (err) {
    ctx.onError(err);
    return NIL;
  }
}

function createID(ctx: SerializerContext, value: unknown): number {
  const id = ctx.refs.size + 1;
  ctx.refs.set(value, id);
  return id;
}

// Node sizes, in bytes, excluding variable-length payloads.
const BYTE = 1;
const UINT = 4;
const NUMBER = 8;

/**
 * Reserves `size` bytes for a node, then writes its type and first reference.
 * Every node is written in one go once the values it references have been
 * written, so nodes never interleave.
 */
function writeNode(
  ctx: SerializerContext,
  type: SerovalBinaryType,
  ref: number,
  size: number,
): ByteWriter {
  const writer = ctx.writer;
  reserveBytes(writer, BYTE + UINT + size);
  writer.bytes[writer.offset++] = type;
  writeUint(writer, ref);
  return writer;
}

function writeRefNode(
  ctx: SerializerContext,
  type: SerovalBinaryType,
  ref: number,
  value: number,
): void {
  writeUint(writeNode(ctx, type, ref, UINT), value);
}

function writeByteNode(
  ctx: SerializerContext,
  type: SerovalBinaryType,
  ref: number,
  value: number,
): void {
  writeByte(writeNode(ctx, type, ref, BYTE), value);
}

function writeUintNode(
  ctx: SerializerContext,
  type: SerovalBinaryType,
  ref: number,
  value: number,
): void {
  writeUint(writeNode(ctx, type, ref, UINT), value);
}

function writePairNode(
  ctx: SerializerContext,
  type: SerovalBinaryType,
  ref: number,
  first: number,
  second: number,
): void {
  const writer = writeNode(ctx, type, ref, UINT + UINT);
  writeUint(writer, first);
  writeUint(writer, second);
}

/**
 * Sends the nodes written so far as one chunk. Serialization writes nodes
 * synchronously and flushes once it hands control back: at the end of the
 * root, and after each settled Promise or stream event.
 */
function flush(ctx: SerializerContext): void | PromiseLike<void> {
  const bytes = flushBytes(ctx.writer);
  if (bytes) {
    return ctx.onSerialize(bytes);
  }
}

function serializePending(
  ctx: SerializerContext,
  source: number,
  amount: number,
): void {
  writeUintNode(ctx, SerovalBinaryType.Pending, source, amount);
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
  writeByteNode(ctx, SerovalBinaryType.Constant, id, value);
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
  writeNumber(writeNode(ctx, SerovalBinaryType.Number, id, NUMBER), value);
  return id;
}

function serializeString(ctx: SerializerContext, value: string) {
  const id = createID(ctx, value);
  writeString(writeNode(ctx, SerovalBinaryType.String, id, 0), value);
  return id;
}

function serializeBigInt(ctx: SerializerContext, value: bigint) {
  const id = createID(ctx, value);
  const digits = serialize(ctx, encodeBigint(value < 0 ? -value : value));
  const writer = writeNode(ctx, SerovalBinaryType.BigInt, id, BYTE + UINT);
  writeByte(writer, value < 0 ? 1 : 0);
  writeUint(writer, digits);
  return id;
}

function serializeWellKnownSymbol(ctx: SerializerContext, value: symbol) {
  if (isWellKnownSymbol(value)) {
    const id = createID(ctx, value);
    writeByteNode(ctx, SerovalBinaryType.WKSymbol, id, INV_SYMBOL_REF[value]);
    return id;
  }
  // TODO allow plugins to support symbols?
  throw new SerovalUnsupportedTypeError(value);
}

function serializeArray(ctx: SerializerContext, value: unknown[]) {
  const id = createID(ctx, value);
  const len = value.length;
  writeUintNode(ctx, SerovalBinaryType.Array, id, len);

  let pending = 0;
  for (let i = 0; i < len; i++) {
    if (i in value) {
      const item = serialize(ctx, value[i]);
      const writer = writeNode(
        ctx,
        SerovalBinaryType.ArrayAssign,
        id,
        UINT + UINT,
      );
      writeUint(writer, i);
      writeUint(writer, item);
      pending++;
    }
  }
  serializePending(ctx, id, pending);
  writeByteNode(ctx, SerovalBinaryType.ObjectFlag, id, getObjectFlag(value));
  return id;
}

function serializeStreamNext(
  ctx: SerializerContext,
  depth: number,
  id: number,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      writeRefNode(ctx, SerovalBinaryType.StreamNext, id, serialized);
    }
    flush(ctx);
  }
}

function serializeStreamThrow(
  ctx: SerializerContext,
  depth: number,
  id: number,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      writeRefNode(ctx, SerovalBinaryType.StreamThrow, id, serialized);
    }
    flush(ctx);
  }
  popPendingState(ctx);
}

function serializeStreamReturn(
  ctx: SerializerContext,
  depth: number,
  id: number,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      writeRefNode(ctx, SerovalBinaryType.StreamReturn, id, serialized);
    }
    flush(ctx);
  }
  popPendingState(ctx);
}

function serializeStream(ctx: SerializerContext, current: Stream<unknown>) {
  const id = createID(ctx, current);
  pushPendingState(ctx);
  writeByteNode(ctx, SerovalBinaryType.Stream, id, 0);

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
  id: number,
  type: LiveEventType,
  value: unknown,
  accept: () => void,
): unknown {
  if (!ctx.alive) {
    return NIL;
  }
  let serialized: number;
  try {
    serialized = serializeWithDepth(ctx, depth, value);
  } catch (error) {
    ctx.onError(error);
    return error;
  }
  writeRefNode(ctx, type, id, serialized);
  const result = flush(ctx);
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
  writeByteNode(ctx, SerovalBinaryType.Stream, id, 1);

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
  const writer = writeNode(ctx, SerovalBinaryType.Sequence, id, UINT + UINT);
  writeInt(writer, value.t);
  writeInt(writer, value.d);
  const length = value.v.length;
  for (let i = 0; i < length; i++) {
    const item = serialize(ctx, value.v[i]);
    writeRefNode(ctx, SerovalBinaryType.SequencePush, id, item);
  }
  serializePending(ctx, id, length);
  return id;
}

function serializeIterator(ctx: SerializerContext, sequence: Sequence) {
  const id = createID(ctx, {});
  const source = serialize(ctx, sequence);
  writeRefNode(ctx, SerovalBinaryType.Iterator, id, source);
  return id;
}

function serializeAsyncIterator(
  ctx: SerializerContext,
  stream: Stream<unknown>,
) {
  const id = createID(ctx, {});
  const source = serialize(ctx, stream);
  writeRefNode(ctx, SerovalBinaryType.AsyncIterator, id, source);
  return id;
}

function serializeProperty(
  ctx: SerializerContext,
  id: number,
  key: number,
  value: unknown,
): void {
  const serialized = serialize(ctx, value);
  writePairNode(ctx, SerovalBinaryType.ObjectAssign, id, key, serialized);
}

function serializeProperties(
  ctx: SerializerContext,
  id: number,
  properties: object,
) {
  const keys = Object.keys(properties);
  let pending = keys.length;
  for (let i = 0; i < pending; i++) {
    const key = keys[i];
    serializeProperty(
      ctx,
      id,
      serialize(ctx, key),
      (properties as Record<string, unknown>)[key],
    );
  }

  // Check special properties, symbols in this case
  if (SYM_ITERATOR in properties) {
    const key = serialize(ctx, SYM_ITERATOR);
    const value = serializeIterator(
      ctx,
      createSequenceFromIterable(properties as unknown as Iterable<unknown>),
    );
    writePairNode(ctx, SerovalBinaryType.ObjectAssign, id, key, value);
    pending++;
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    const key = serialize(ctx, SYM_ASYNC_ITERATOR);
    const value = serializeAsyncIterator(
      ctx,
      createStreamFromAsyncIterable(
        properties as unknown as AsyncIterable<unknown>,
        ctx.cleanups,
      ),
    );
    writePairNode(ctx, SerovalBinaryType.ObjectAssign, id, key, value);
    pending++;
  }
  if (SYM_TO_STRING_TAG in properties) {
    serializeProperty(
      ctx,
      id,
      serialize(ctx, SYM_TO_STRING_TAG),
      properties[SYM_TO_STRING_TAG],
    );
    pending++;
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    serializeProperty(
      ctx,
      id,
      serialize(ctx, SYM_IS_CONCAT_SPREADABLE),
      properties[SYM_IS_CONCAT_SPREADABLE],
    );
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
  writeNode(
    ctx,
    empty ? SerovalBinaryType.NullConstructor : SerovalBinaryType.Object,
    id,
    0,
  );
  serializeProperties(ctx, id, value);
  writeByteNode(ctx, SerovalBinaryType.ObjectFlag, id, getObjectFlag(value));
  return id;
}

function serializeDate(ctx: SerializerContext, value: Date) {
  const id = createID(ctx, value);
  writeNumber(
    writeNode(ctx, SerovalBinaryType.Date, id, NUMBER),
    value.getTime(),
  );
  return id;
}

function serializeError(ctx: SerializerContext, value: Error) {
  const id = createID(ctx, value);
  const message = serialize(ctx, value.message);
  const writer = writeNode(ctx, SerovalBinaryType.Error, id, BYTE + UINT);
  writeByte(writer, getErrorConstructor(value));
  writeUint(writer, message);
  serializeErrorProperties(ctx, id, value);
  return id;
}

// Errors always end with a `Pending` node, even with no extra properties, so
// the decoder can tell when the error is complete.
function serializeErrorProperties(
  ctx: SerializerContext,
  id: number,
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
  const boxed = serialize(ctx, value.valueOf());
  writeRefNode(ctx, SerovalBinaryType.Boxed, id, boxed);
  return id;
}

function serializeArrayBuffer(ctx: SerializerContext, value: ArrayBuffer) {
  const id = createID(ctx, value);
  const arr = new Uint8Array(value);
  const writer = writeNode(
    ctx,
    SerovalBinaryType.ArrayBuffer,
    id,
    UINT + arr.length,
  );
  writeUint(writer, arr.length);
  writeBytes(writer, arr);
  return id;
}

function serializeTypedArray(ctx: SerializerContext, value: TypedArrayValue) {
  if (value.length > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalUnsupportedTypeError(value);
  }
  const id = createID(ctx, value);
  const buffer = serialize(ctx, value.buffer);
  const writer = writeNode(
    ctx,
    SerovalBinaryType.TypedArray,
    id,
    BYTE + UINT + UINT + UINT,
  );
  writeByte(writer, getTypedArrayTag(value));
  writeUint(writer, buffer);
  writeUint(writer, value.byteOffset);
  writeUint(writer, value.length);
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
  const buffer = serialize(ctx, value.buffer);
  const writer = writeNode(
    ctx,
    SerovalBinaryType.BigIntTypedArray,
    id,
    BYTE + UINT + UINT + UINT,
  );
  writeByte(writer, getBigIntTypedArrayTag(value));
  writeUint(writer, buffer);
  writeUint(writer, value.byteOffset);
  writeUint(writer, value.length);
  return id;
}

function serializeDataView(ctx: SerializerContext, value: DataView) {
  if (value.byteLength > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalUnsupportedTypeError(value);
  }
  const id = createID(ctx, value);
  const buffer = serialize(ctx, value.buffer);
  const writer = writeNode(
    ctx,
    SerovalBinaryType.DataView,
    id,
    UINT + UINT + UINT,
  );
  writeUint(writer, buffer);
  writeUint(writer, value.byteOffset);
  writeUint(writer, value.byteLength);
  return id;
}

function serializeMap(ctx: SerializerContext, value: Map<unknown, unknown>) {
  const id = createID(ctx, value);
  writeNode(ctx, SerovalBinaryType.Map, id, 0);
  for (const [key, val] of value.entries()) {
    const serializedKey = serialize(ctx, key);
    const serializedValue = serialize(ctx, val);
    writePairNode(
      ctx,
      SerovalBinaryType.MapSet,
      id,
      serializedKey,
      serializedValue,
    );
  }
  serializePending(ctx, id, value.size);
  return id;
}

function serializeSet(ctx: SerializerContext, value: Set<unknown>) {
  const id = createID(ctx, value);
  writeNode(ctx, SerovalBinaryType.Set, id, 0);
  for (const key of value.keys()) {
    const serialized = serialize(ctx, key);
    writeRefNode(ctx, SerovalBinaryType.SetAdd, id, serialized);
  }
  serializePending(ctx, id, value.size);
  return id;
}

function serializePromiseSuccess(
  ctx: SerializerContext,
  depth: number,
  id: number,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      writeRefNode(ctx, SerovalBinaryType.PromiseSuccess, id, serialized);
    }
    flush(ctx);
  }
  popPendingState(ctx);
}

function serializePromiseFailure(
  ctx: SerializerContext,
  depth: number,
  id: number,
  value: unknown,
) {
  if (ctx.alive) {
    const serialized = serializeWithError(ctx, depth, value);
    if (serialized) {
      writeRefNode(ctx, SerovalBinaryType.PromiseFailure, id, serialized);
    }
    flush(ctx);
  }
  popPendingState(ctx);
}

function serializePromise(ctx: SerializerContext, value: Promise<unknown>) {
  const id = createID(ctx, value);
  writeNode(ctx, SerovalBinaryType.Promise, id, 0);
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
  const source = serialize(ctx, value.source);
  const flags = serialize(ctx, value.flags);
  writePairNode(ctx, SerovalBinaryType.RegExp, id, source, flags);
  return id;
}

function serializeAggregateError(
  ctx: SerializerContext,
  value: AggregateError,
) {
  const id = createID(ctx, value);
  const message = serialize(ctx, value.message);
  writeRefNode(ctx, SerovalBinaryType.AggregateError, id, message);
  serializeErrorProperties(ctx, id, value);
  return id;
}

function serializeTemporal(
  ctx: SerializerContext,
  value: SerovalTemporalValue,
  type: SerovalTemporalType,
) {
  const id = createID(ctx, value);
  const iso = serialize(ctx, value.toString());
  const writer = writeNode(ctx, SerovalBinaryType.Temporal, id, BYTE + UINT);
  writeByte(writer, type);
  writeUint(writer, iso);
  return id;
}

function serializeObjectPhase2(
  ctx: SerializerContext,
  current: object,
  currentClass: unknown,
): number {
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
        const tag = serialize(ctx, current.tag);
        const payload = serialize(
          ctx,
          current.binary.serialize(value, ctx.pluginContext),
        );
        writePairNode(ctx, SerovalBinaryType.Plugin, id, tag, payload);
        return id;
      }
    }
  }
  return undefined;
}

function serializeObject(ctx: SerializerContext, value: object): number {
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

function serializeReference(
  ctx: SerializerContext,
  value: unknown,
  key: string,
) {
  const id = createID(ctx, value);
  const serialized = serialize(ctx, key);
  writeRefNode(ctx, SerovalBinaryType.Reference, id, serialized);
  return id;
}

function serializeFunction(ctx: SerializerContext, current: Function) {
  const plugin = serializePlugin(ctx, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

function serialize<T>(ctx: SerializerContext, current: T): number {
  if (CURRENT_DEPTH >= ctx.depthLimit) {
    throw new SerovalDepthLimitError(ctx.depthLimit);
  }
  // `-0` must not reuse the id of `0`: both are the same Map key.
  const currentID = Object.is(current, -0) ? NIL : ctx.refs.get(current);
  if (currentID != null) {
    return currentID;
  }
  // A value registered with `createReference` is sent by its key, the same
  // as in the other modes. The receiving side must register the same key.
  if (
    (typeof current === 'object' && current) ||
    typeof current === 'function' ||
    typeof current === 'symbol'
  ) {
    const key = getReferenceID(current);
    if (key !== undefined) {
      return serializeReference(ctx, current, key);
    }
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

const ENDIANNESS = NATIVE_LITTLE_ENDIAN
  ? SerovalEndianness.LE
  : SerovalEndianness.BE;

export function startSerialize<T>(ctx: SerializerContext, value: T) {
  const writer = ctx.writer;
  reserveBytes(writer, BYTE + BYTE);
  writeByte(writer, SerovalBinaryType.Preamble);
  writeByte(writer, ENDIANNESS);
  // Hold a pending slot for the duration of the root traversal: a source that
  // completes synchronously (an already-finished Stream, for example) would
  // otherwise end the serialization before the root node is written.
  pushPendingState(ctx);
  const serialized = serializeWithError(ctx, 0, value);
  if (serialized) {
    reserveBytes(writer, BYTE + UINT);
    writeByte(writer, SerovalBinaryType.Root);
    writeUint(writer, serialized);
    flush(ctx);

    popPendingState(ctx);
  } else {
    // Nodes written before the failure are still sent.
    flush(ctx);
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
