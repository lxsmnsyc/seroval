import { ALL_ENABLED, Feature } from '../core/compat';
import {
  BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
  type BigIntTypedArrayTag,
  CONSTANT_VAL,
  ERROR_CONSTRUCTOR,
  type ErrorConstructorTag,
  type SerovalConstant,
  SerovalObjectFlags,
  SYMBOL_REF,
  type Symbols,
  TYPED_ARRAY_CONSTRUCTOR,
  type TypedArrayTag,
} from '../core/constants';
import {
  PROMISE_CONSTRUCTOR,
  type PromiseConstructorResolver,
} from '../core/constructors';
import {
  SerovalMalformedBinarySourceError,
  SerovalMalformedBinaryTypeError,
  SerovalMissingPluginError,
  SerovalUnexpectedBinaryTypeError,
  SerovalUnknownBinaryTypeError,
} from '../core/errors';
import {
  createSequence,
  type Sequence,
  sequenceToIterator,
} from '../core/sequence';
import {
  createStream,
  type Stream,
  streamToAsyncIterable,
} from '../core/stream';
import {
  SYM_ASYNC_ITERATOR,
  SYM_IS_CONCAT_SPREADABLE,
  SYM_ITERATOR,
  SYM_TO_STRING_TAG,
} from '../core/symbols';
import {
  decodeBigint,
  decodeInt,
  decodeNumber,
  decodeString,
  decodeUint,
} from './encoder';
import { SerovalBinaryType, SerovalEndianness } from './nodes';
import type { Plugin } from './plugin';

const MAX_REGEXP_SOURCE_LENGTH = 20_000;

export interface DeserializerContextOptions {
  read(): Promise<Uint8Array | undefined>;
  onError(error: unknown): void;
  refs: Map<number, { value: unknown }>;
  plugins?: Plugin<any, any>[];
  disabledFeatures?: number;
  features?: number;
}

export interface DeserializerContext {
  read(): Promise<Uint8Array | undefined>;
  onError(error: unknown): void;
  refs: Map<number, { value: unknown }>;
  plugins?: Plugin<any, any>[];
  root: PromiseConstructorResolver;
  done: boolean;
  buffer: Uint8Array;
  marker: Map<number, SerovalBinaryType>;
  resolvers: Map<number, PromiseConstructorResolver>;
  endianness: SerovalEndianness;
  features: number;
}

export function createDeserializerContext(
  options: DeserializerContextOptions,
): DeserializerContext {
  return {
    done: false,
    buffer: new Uint8Array(),
    root: PROMISE_CONSTRUCTOR(),
    read: options.read,
    onError: options.onError,
    refs: options.refs,
    marker: new Map(),
    resolvers: new Map(),
    endianness: SerovalEndianness.LE,
    features: options.features ?? ALL_ENABLED ^ (options.disabledFeatures || 0),
  };
}

async function readChunk(ctx: DeserializerContext) {
  // if there's no chunk, read again
  const chunk = await ctx.read();
  if (chunk) {
    // repopulate the buffer
    const newBuffer = new Uint8Array(ctx.buffer.length + chunk.length);
    newBuffer.set(ctx.buffer);
    newBuffer.set(chunk, ctx.buffer.length);
    ctx.buffer = newBuffer;
  } else {
    ctx.done = true;
  }
}

function resizeBuffer(ctx: DeserializerContext, consumedLength: number) {
  const currentChunk = ctx.buffer.subarray(0, consumedLength);
  ctx.buffer = ctx.buffer.subarray(consumedLength);
  return currentChunk;
}

async function ensureChunk(ctx: DeserializerContext, requiredLength: number) {
  // Check if the buffer has enough bytes to be parsed
  while (requiredLength > ctx.buffer.length) {
    // If it's not enough, and the reader is done
    // then the chunk is invalid.
    if (ctx.done) {
      throw new SerovalMalformedBinarySourceError();
    }
    // Otherwise, we read more chunks
    await readChunk(ctx);
  }

  return resizeBuffer(ctx, requiredLength);
}

function upsert(ctx: DeserializerContext, id: number, value: unknown): unknown {
  ctx.refs.set(id, { value });
  return value;
}

function deserializeKnownValue<
  T extends Record<string, unknown>,
  K extends keyof T,
>(type: SerovalBinaryType, record: T, key: K): T[K] {
  if (Object.hasOwn(record, key)) {
    return record[key];
  }
  throw new SerovalMalformedBinaryTypeError(type);
}

async function deserializeByte(ctx: DeserializerContext): Promise<number> {
  const bytes = await ensureChunk(ctx, 1);
  return bytes[0];
}

async function deserializeUint(ctx: DeserializerContext): Promise<number> {
  const bytes = await ensureChunk(ctx, 4);
  return decodeUint(bytes, ctx.endianness === SerovalEndianness.LE);
}

async function deserializeInt(ctx: DeserializerContext): Promise<number> {
  const bytes = await ensureChunk(ctx, 4);
  return decodeInt(bytes, ctx.endianness === SerovalEndianness.LE);
}

async function deserializeNumberValue(
  ctx: DeserializerContext,
): Promise<number> {
  const bytes = await ensureChunk(ctx, 8);
  return decodeNumber(bytes, ctx.endianness === SerovalEndianness.LE);
}

async function deserializePreamble(ctx: DeserializerContext) {
  ctx.endianness = (await deserializeByte(ctx)) as SerovalEndianness;
}

async function deserializeId(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
): Promise<number> {
  // parse ID
  const id = await deserializeUint(ctx);
  // Mark id
  ctx.marker.set(id, type);
  return id;
}

async function deserializeRef(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  expected?: SerovalBinaryType,
) {
  const ref = await deserializeUint(ctx);
  if (expected != null) {
    const marker = ctx.marker.get(expected);
    if (marker == null) {
      throw new SerovalMalformedBinaryTypeError(type);
    }
    if (marker !== expected) {
      throw new SerovalUnexpectedBinaryTypeError(type, expected, marker);
    }
  }
  if (ctx.refs.has(ref)) {
    return ctx.refs.get(ref)!;
  }
  throw new SerovalMalformedBinaryTypeError(type);
}

async function deserializeConstant(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Constant);
  const byte = (await deserializeByte(ctx)) as SerovalConstant;
  upsert(
    ctx,
    id,
    deserializeKnownValue(SerovalBinaryType.Constant, CONSTANT_VAL, byte),
  );
}

async function deserializeNumber(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Number);
  upsert(ctx, id, await deserializeNumberValue(ctx));
}

async function deserializeString(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.String);
  // First, ensure that there's an encoded length
  const length = await deserializeUint(ctx);
  // Ensure the next chunk is based on encoded length
  const encodedData = await ensureChunk(ctx, length);
  upsert(ctx, id, decodeString(encodedData));
}

async function deserializeBigint(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.BigInt);
  // Check if the value exists
  const current = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.BigInt,
      SerovalBinaryType.String,
    )
  ).value;
  upsert(ctx, id, decodeBigint(current as string));
}

async function deserializeWKSymbol(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.WKSymbol);
  const byte = (await deserializeByte(ctx)) as Symbols;
  upsert(
    ctx,
    id,
    deserializeKnownValue(SerovalBinaryType.WKSymbol, SYMBOL_REF, byte),
  );
}

function isValidKey(key: string): boolean {
  switch (key) {
    case 'constructor':
    case '__proto__':
    case 'prototype':
    case '__defineGetter__':
    case '__defineSetter__':
    case '__lookupGetter__':
    case '__lookupSetter__':
      // case 'then':
      return false;
    default:
      return true;
  }
}

function isValidSymbol(symbol: symbol): boolean {
  switch (symbol) {
    case SYM_ASYNC_ITERATOR:
    case SYM_IS_CONCAT_SPREADABLE:
    case SYM_TO_STRING_TAG:
    case SYM_ITERATOR:
      return true;
    default:
      return false;
  }
}

function assignProperty(
  object: Record<string | symbol, unknown>,
  key: string | symbol,
  value: unknown,
): void {
  if (typeof key === 'string') {
    if (isValidKey(key)) {
      object[key] = value;
    } else {
      Object.defineProperty(object, key, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
  } else if (isValidSymbol(key)) {
    object[key] = value;
  }
}

async function deserializeObjectAssign(ctx: DeserializerContext) {
  // TODO union type for object, null constructor and error
  const object = (await deserializeRef(ctx, SerovalBinaryType.ObjectAssign))
    .value as Record<string | symbol, unknown>;
  // TODO union type for string and symbol
  const key = (await deserializeRef(ctx, SerovalBinaryType.ObjectAssign))
    .value as string | symbol;
  const value = (await deserializeRef(ctx, SerovalBinaryType.ObjectAssign))
    .value;

  assignProperty(object, key, value);
}

async function deserializeArrayAssign(ctx: DeserializerContext) {
  const object = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.ArrayAssign,
      SerovalBinaryType.Array,
    )
  ).value as unknown[];
  const key = (await deserializeUint(ctx)) as number;
  const value = (await deserializeRef(ctx, SerovalBinaryType.ArrayAssign))
    .value;

  object[key] = value;
}

async function deserializeObjectFlag(ctx: DeserializerContext) {
  // TODO union type for object, null constructor and array
  const object = (await deserializeRef(ctx, SerovalBinaryType.ObjectFlag))
    .value;
  const flag = (await deserializeByte(ctx)) as SerovalObjectFlags;

  switch (flag) {
    case SerovalObjectFlags.Frozen:
      Object.freeze(object);
      break;
    case SerovalObjectFlags.NonExtensible:
      Object.preventExtensions(object);
      break;
    case SerovalObjectFlags.Sealed:
      Object.seal(object);
      break;
  }
}

async function deserializeArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Array);
  const length = await deserializeUint(ctx);
  upsert(ctx, id, new Array(length));
}

async function deserializeStream(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Stream);
  upsert(ctx, id, createStream());
}

async function deserializeStreamNext(ctx: DeserializerContext) {
  const stream = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.StreamNext,
      SerovalBinaryType.Stream,
    )
  ).value as Stream<unknown>;
  const value = (await deserializeRef(ctx, SerovalBinaryType.StreamNext)).value;
  stream.next(value);
}

async function deserializeStreamThrow(ctx: DeserializerContext) {
  const stream = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.StreamThrow,
      SerovalBinaryType.Stream,
    )
  ).value as Stream<unknown>;
  const value = (await deserializeRef(ctx, SerovalBinaryType.StreamThrow))
    .value;
  stream.throw(value);
}

async function deserializeStreamReturn(ctx: DeserializerContext) {
  const stream = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.StreamReturn,
      SerovalBinaryType.Stream,
    )
  ).value as Stream<unknown>;
  const value = (await deserializeRef(ctx, SerovalBinaryType.StreamReturn))
    .value;
  stream.return(value);
}

async function deserializeSequence(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Sequence);
  const throwAt = await deserializeInt(ctx);
  const doneAt = await deserializeInt(ctx);
  upsert(ctx, id, createSequence([], throwAt, doneAt));
}

async function deserializeSequencePush(ctx: DeserializerContext) {
  const sequence = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.SequencePush,
      SerovalBinaryType.Sequence,
    )
  ).value as Sequence;
  const value = (await deserializeRef(ctx, SerovalBinaryType.SequencePush))
    .value;
  sequence.v.push(value);
}

async function deserializeObject(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Object);
  upsert(ctx, id, {});
}

async function deserializeNullConstructor(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.NullConstructor);
  upsert(ctx, id, Object.create(null));
}

async function deserializeDate(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Date);
  const timestamp = await deserializeUint(ctx);
  upsert(ctx, id, new Date(timestamp));
}

async function deserializeError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Error);
  const construct = deserializeKnownValue(
    SerovalBinaryType.Error,
    ERROR_CONSTRUCTOR,
    (await deserializeByte(ctx)) as ErrorConstructorTag,
  );
  const message = (
    await deserializeRef(ctx, SerovalBinaryType.Error, SerovalBinaryType.String)
  ).value as string;
  upsert(ctx, id, new construct(message));
}

async function deserializeBoxed(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Boxed);
  const value = (await deserializeRef(ctx, SerovalBinaryType.Boxed)).value;
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: intentional
  upsert(ctx, id, Object(value));
}

async function deserializeArrayBuffer(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.ArrayBuffer);
  const length = await deserializeUint(ctx);
  const bytes = await ensureChunk(ctx, length);
  upsert(ctx, id, bytes.buffer);
}

async function deserializeTypedArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.TypedArray);
  const construct = deserializeKnownValue(
    SerovalBinaryType.TypedArray,
    TYPED_ARRAY_CONSTRUCTOR,
    (await deserializeByte(ctx)) as TypedArrayTag,
  );
  const offset = await deserializeUint(ctx);
  const length = await deserializeUint(ctx);
  const buffer = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.TypedArray,
      SerovalBinaryType.ArrayBuffer,
    )
  ).value as ArrayBuffer;
  upsert(ctx, id, new construct(buffer, offset, length));
}

async function deserializeBigIntTypedArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.BigIntTypedArray);
  const construct = deserializeKnownValue(
    SerovalBinaryType.BigIntTypedArray,
    BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
    (await deserializeByte(ctx)) as BigIntTypedArrayTag,
  );
  const offset = await deserializeUint(ctx);
  const length = await deserializeUint(ctx);
  const buffer = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.TypedArray,
      SerovalBinaryType.ArrayBuffer,
    )
  ).value as ArrayBuffer;
  upsert(ctx, id, new construct(buffer, offset, length));
}

async function deserializeDataView(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.DataView);
  const offset = await deserializeUint(ctx);
  const length = await deserializeUint(ctx);
  const buffer = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.TypedArray,
      SerovalBinaryType.ArrayBuffer,
    )
  ).value as ArrayBuffer;
  upsert(ctx, id, new DataView(buffer, offset, length));
}

async function deserializeMap(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Map);
  upsert(ctx, id, new Map());
}

async function deserializeMapSet(ctx: DeserializerContext) {
  const map = (
    await deserializeRef(ctx, SerovalBinaryType.MapSet, SerovalBinaryType.Map)
  ).value as Map<unknown, unknown>;
  const index = (await deserializeRef(ctx, SerovalBinaryType.MapSet)).value;
  const value = (await deserializeRef(ctx, SerovalBinaryType.MapSet)).value;
  map.set(index, value);
}

async function deserializeSet(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Set);
  upsert(ctx, id, new Set());
}

async function deserializeSetAdd(ctx: DeserializerContext) {
  const set = (
    await deserializeRef(ctx, SerovalBinaryType.SetAdd, SerovalBinaryType.Set)
  ).value as Set<unknown>;
  const value = (await deserializeRef(ctx, SerovalBinaryType.SetAdd)).value;
  set.add(value);
}

async function deserializePromise(ctx: DeserializerContext) {
  const promise = await deserializeId(ctx, SerovalBinaryType.Promise);

  const instance = PROMISE_CONSTRUCTOR();
  ctx.resolvers.set(promise, instance);
  upsert(ctx, promise, instance.p);
}

async function deserializePromiseSuccess(ctx: DeserializerContext) {
  const resolverIndex = await deserializeUint(ctx);
  const currentResolver = ctx.resolvers.get(resolverIndex);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseSuccess);
  }
  const value = (await deserializeRef(ctx, SerovalBinaryType.PromiseSuccess))
    .value;
  currentResolver.s(value);
}

async function deserializePromiseFailure(ctx: DeserializerContext) {
  const resolverIndex = await deserializeUint(ctx);
  const currentResolver = ctx.resolvers.get(resolverIndex);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseFailure);
  }
  const value = (await deserializeRef(ctx, SerovalBinaryType.PromiseFailure))
    .value;
  currentResolver.f(value);
}

async function deserializeRegExp(ctx: DeserializerContext) {
  if (!(ctx.features & Feature.RegExp)) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.RegExp);
  }
  const id = await deserializeId(ctx, SerovalBinaryType.RegExp);
  const pattern = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.RegExp,
      SerovalBinaryType.String,
    )
  ).value as string;
  if (pattern.length > MAX_REGEXP_SOURCE_LENGTH) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.RegExp);
  }
  const flags = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.RegExp,
      SerovalBinaryType.String,
    )
  ).value as string;
  upsert(ctx, id, new RegExp(pattern, flags));
}

async function deserializeAggregateError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.AggregateError);
  const message = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.AggregateError,
      SerovalBinaryType.String,
    )
  ).value as string;
  upsert(ctx, id, new AggregateError([], message));
}

async function deserializePlugin(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Plugin);
  const tag = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.Plugin,
      SerovalBinaryType.String,
    )
  ).value as string;
  const options = (await deserializeRef(ctx, SerovalBinaryType.Plugin)).value;

  if (ctx.plugins) {
    for (let i = 0, len = ctx.plugins.length; i < len; i++) {
      const current = ctx.plugins[i];
      if (current.tag === tag) {
        upsert(ctx, id, current.deserialize(options));
        return;
      }
    }
  }
  throw new SerovalMissingPluginError(tag);
}

async function deserializeRoot(ctx: DeserializerContext) {
  const reference = await deserializeRef(ctx, SerovalBinaryType.Root);
  ctx.root.s(reference);
}

async function deserializeIterator(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Iterator);
  const sequence = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.Iterator,
      SerovalBinaryType.Sequence,
    )
  ).value as Sequence;
  upsert(ctx, id, sequenceToIterator(sequence));
}

async function deserializeAsyncIterator(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.AsyncIterator);
  const stream = (
    await deserializeRef(
      ctx,
      SerovalBinaryType.AsyncIterator,
      SerovalBinaryType.Stream,
    )
  ).value as Stream<unknown>;
  upsert(ctx, id, streamToAsyncIterable(stream));
}

async function deserializeChunk(ctx: DeserializerContext) {
  // Read first byte
  const firstByte = (await deserializeByte(ctx)) as SerovalBinaryType;

  switch (firstByte) {
    case SerovalBinaryType.Preamble:
      await deserializePreamble(ctx);
      break;
    case SerovalBinaryType.Constant:
      await deserializeConstant(ctx);
      break;
    case SerovalBinaryType.Number:
      await deserializeNumber(ctx);
      break;
    case SerovalBinaryType.String:
      await deserializeString(ctx);
      break;
    case SerovalBinaryType.BigInt:
      await deserializeBigint(ctx);
      break;
    case SerovalBinaryType.WKSymbol:
      await deserializeWKSymbol(ctx);
      break;
    case SerovalBinaryType.ObjectAssign:
      await deserializeObjectAssign(ctx);
      break;
    case SerovalBinaryType.ArrayAssign:
      await deserializeArrayAssign(ctx);
      break;
    case SerovalBinaryType.ObjectFlag:
      await deserializeObjectFlag(ctx);
      break;
    case SerovalBinaryType.Array:
      await deserializeArray(ctx);
      break;
    case SerovalBinaryType.Stream:
      await deserializeStream(ctx);
      break;
    case SerovalBinaryType.StreamNext:
      await deserializeStreamNext(ctx);
      break;
    case SerovalBinaryType.StreamThrow:
      await deserializeStreamThrow(ctx);
      break;
    case SerovalBinaryType.StreamReturn:
      await deserializeStreamReturn(ctx);
      break;
    case SerovalBinaryType.Sequence:
      await deserializeSequence(ctx);
      break;
    case SerovalBinaryType.SequencePush:
      await deserializeSequencePush(ctx);
      break;
    case SerovalBinaryType.Object:
      await deserializeObject(ctx);
      break;
    case SerovalBinaryType.NullConstructor:
      await deserializeNullConstructor(ctx);
      break;
    case SerovalBinaryType.Date:
      await deserializeDate(ctx);
      break;
    case SerovalBinaryType.Error:
      await deserializeError(ctx);
      break;
    case SerovalBinaryType.Boxed:
      await deserializeBoxed(ctx);
      break;
    case SerovalBinaryType.ArrayBuffer:
      await deserializeArrayBuffer(ctx);
      break;
    case SerovalBinaryType.TypedArray:
      await deserializeTypedArray(ctx);
      break;
    case SerovalBinaryType.BigIntTypedArray:
      await deserializeBigIntTypedArray(ctx);
      break;
    case SerovalBinaryType.DataView:
      await deserializeDataView(ctx);
      break;
    case SerovalBinaryType.Map:
      await deserializeMap(ctx);
      break;
    case SerovalBinaryType.MapSet:
      await deserializeMapSet(ctx);
      break;
    case SerovalBinaryType.Set:
      await deserializeSet(ctx);
      break;
    case SerovalBinaryType.SetAdd:
      await deserializeSetAdd(ctx);
      break;
    case SerovalBinaryType.Promise:
      await deserializePromise(ctx);
      break;
    case SerovalBinaryType.PromiseSuccess:
      await deserializePromiseSuccess(ctx);
      break;
    case SerovalBinaryType.PromiseFailure:
      await deserializePromiseFailure(ctx);
      break;
    case SerovalBinaryType.RegExp:
      await deserializeRegExp(ctx);
      break;
    case SerovalBinaryType.AggregateError:
      await deserializeAggregateError(ctx);
      break;
    case SerovalBinaryType.Plugin:
      await deserializePlugin(ctx);
      break;
    case SerovalBinaryType.Root:
      await deserializeRoot(ctx);
      break;
    case SerovalBinaryType.Iterator:
      await deserializeIterator(ctx);
      break;
    case SerovalBinaryType.AsyncIterator:
      await deserializeAsyncIterator(ctx);
      break;
    default:
      throw new SerovalUnknownBinaryTypeError(firstByte);
  }
}

async function drain(ctx: DeserializerContext) {
  while (true) {
    if (ctx.buffer.length === 0) {
      if (ctx.done) {
        return;
      }
      await readChunk(ctx);
    } else {
      await deserializeChunk(ctx);
    }
  }
}

export function deserializeStart(ctx: DeserializerContext) {
  void drain(ctx).catch(ctx.onError.bind(ctx));
  return ctx.root.p;
}
