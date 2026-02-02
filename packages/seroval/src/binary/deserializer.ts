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
  SerovalMalformedBinaryError,
  SerovalMissingPluginError,
} from '../core/errors';
import { createSequence, type Sequence } from '../core/sequence';
import { createStream, type Stream } from '../core/stream';
import {
  SYM_ASYNC_ITERATOR,
  SYM_IS_CONCAT_SPREADABLE,
  SYM_ITERATOR,
  SYM_TO_STRING_TAG,
} from '../core/symbols';
import {
  decodeBigint,
  decodeInteger,
  decodeNumber,
  decodeString,
} from './encoder';
import { SerovalNodeType } from './nodes';
import type { Plugin } from './plugin';

export interface DeserializerContextOptions {
  read(): Promise<Uint8Array | undefined>;
  refs: Map<number, { value: unknown }>;
  plugins?: Plugin<any, any>[];
}

export interface DeserializerContext {
  read(): Promise<Uint8Array | undefined>;
  refs: Map<number, { value: unknown }>;
  plugins?: Plugin<any, any>[];
  root: PromiseConstructorResolver;
  done: boolean;
  buffer: Uint8Array;
  marker: Map<number, SerovalNodeType>;
  resolvers: Map<number, PromiseConstructorResolver>;
}

export function createDeserializerContext(
  options: DeserializerContextOptions,
): DeserializerContext {
  return {
    done: false,
    buffer: new Uint8Array(),
    root: PROMISE_CONSTRUCTOR(),
    read: options.read,
    refs: options.refs,
    marker: new Map(),
    resolvers: new Map(),
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
      throw new SerovalMalformedBinaryError();
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
>(record: T, key: K): T[K] {
  if (Object.hasOwn(record, key)) {
    return record[key];
  }
  throw new SerovalMalformedBinaryError();
}

async function deserializeByte(ctx: DeserializerContext): Promise<number> {
  const bytes = await ensureChunk(ctx, 1);
  return bytes[0];
}

async function deserializeInteger(ctx: DeserializerContext): Promise<number> {
  const bytes = await ensureChunk(ctx, 4);
  return decodeInteger(bytes);
}

async function deserializeNumberValue(
  ctx: DeserializerContext,
): Promise<number> {
  const bytes = await ensureChunk(ctx, 8);
  return decodeNumber(bytes);
}

async function deserializeId(
  ctx: DeserializerContext,
  type: SerovalNodeType,
): Promise<number> {
  // parse ID
  const id = await deserializeInteger(ctx);
  // Mark id
  ctx.marker.set(id, type);
  return id;
}

async function deserializeRef(ctx: DeserializerContext) {
  const ref = await deserializeInteger(ctx);
  if (ctx.refs.has(ref)) {
    return ctx.refs.get(ref)!;
  }
  throw new SerovalMalformedBinaryError();
}

async function deserializeConstant(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Constant);
  const byte = (await deserializeByte(ctx)) as SerovalConstant;
  upsert(ctx, id, deserializeKnownValue(CONSTANT_VAL, byte));
}

async function deserializeNumber(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Number);
  upsert(ctx, id, await deserializeNumberValue(ctx));
}

async function deserializeString(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.String);
  // First, ensure that there's an encoded length
  const length = await deserializeInteger(ctx);
  // Ensure the next chunk is based on encoded length
  const encodedData = await ensureChunk(ctx, length);
  upsert(ctx, id, decodeString(encodedData));
}

async function deserializeBigint(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.BigInt);
  // Check if the value exists
  const current = (await deserializeRef(ctx)).value;
  upsert(ctx, id, decodeBigint(current as string));
}

async function deserializeWKSymbol(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.WKSymbol);
  const byte = (await deserializeByte(ctx)) as Symbols;
  upsert(ctx, id, deserializeKnownValue(SYMBOL_REF, byte));
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
  const object = (await deserializeRef(ctx)).value as Record<
    string | symbol,
    unknown
  >;
  const key = (await deserializeRef(ctx)).value as string | symbol;
  const value = (await deserializeRef(ctx)).value;

  assignProperty(object, key, value);
}

async function deserializeArrayAssign(ctx: DeserializerContext) {
  const object = (await deserializeRef(ctx)).value as unknown[];
  const key = (await deserializeInteger(ctx)) as number;
  const value = (await deserializeRef(ctx)).value;

  object[key] = value;
}

async function deserializeObjectFlag(ctx: DeserializerContext) {
  const object = (await deserializeRef(ctx)).value;
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
  const id = await deserializeId(ctx, SerovalNodeType.Array);
  const length = await deserializeInteger(ctx);
  upsert(ctx, id, new Array(length));
}

async function deserializeStream(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Stream);
  upsert(ctx, id, createStream());
}

async function deserializeStreamNext(ctx: DeserializerContext) {
  const stream = (await deserializeRef(ctx)).value as Stream<unknown>;
  const value = (await deserializeRef(ctx)).value;
  stream.next(value);
}

async function deserializeStreamThrow(ctx: DeserializerContext) {
  const stream = (await deserializeRef(ctx)).value as Stream<unknown>;
  const value = (await deserializeRef(ctx)).value;
  stream.throw(value);
}

async function deserializeStreamReturn(ctx: DeserializerContext) {
  const stream = (await deserializeRef(ctx)).value as Stream<unknown>;
  const value = (await deserializeRef(ctx)).value;
  stream.return(value);
}

async function deserializeSequence(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Sequence);
  const throwAt = await deserializeNumberValue(ctx);
  const doneAt = await deserializeNumberValue(ctx);
  upsert(ctx, id, createSequence([], throwAt, doneAt));
}

async function deserializeSequencePush(ctx: DeserializerContext) {
  const sequence = (await deserializeRef(ctx)).value as Sequence;
  const value = (await deserializeRef(ctx)).value;
  sequence.v.push(value);
}

async function deserializeObject(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Object);
  upsert(ctx, id, {});
}

async function deserializeNullConstructor(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.NullConstructor);
  upsert(ctx, id, Object.create(null));
}

async function deserializeDate(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Date);
  const timestamp = await deserializeInteger(ctx);
  upsert(ctx, id, new Date(timestamp));
}

async function deserializeError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Error);
  const construct = deserializeKnownValue(
    ERROR_CONSTRUCTOR,
    (await deserializeByte(ctx)) as ErrorConstructorTag,
  );
  const message = (await deserializeRef(ctx)).value as string;
  upsert(ctx, id, new construct(message));
}

async function deserializeBoxed(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Boxed);
  const value = (await deserializeRef(ctx)).value;
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: intentional
  upsert(ctx, id, Object(value));
}

async function deserializeArrayBuffer(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.ArrayBuffer);
  const length = await deserializeInteger(ctx);
  const bytes = await ensureChunk(ctx, length);
  upsert(ctx, id, bytes.buffer);
}

async function deserializeTypedArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.TypedArray);
  const construct = deserializeKnownValue(
    TYPED_ARRAY_CONSTRUCTOR,
    (await deserializeByte(ctx)) as TypedArrayTag,
  );
  const offset = await deserializeInteger(ctx);
  const length = await deserializeInteger(ctx);
  const buffer = (await deserializeRef(ctx)).value as ArrayBuffer;
  upsert(ctx, id, new construct(buffer, offset, length));
}

async function deserializeBigIntTypedArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.BigIntTypedArray);
  const construct = deserializeKnownValue(
    BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
    (await deserializeByte(ctx)) as BigIntTypedArrayTag,
  );
  const offset = await deserializeInteger(ctx);
  const length = await deserializeInteger(ctx);
  const buffer = (await deserializeRef(ctx)).value as ArrayBuffer;
  upsert(ctx, id, new construct(buffer, offset, length));
}

async function deserializeDataView(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.DataView);
  const offset = await deserializeInteger(ctx);
  const length = await deserializeInteger(ctx);
  const buffer = (await deserializeRef(ctx)).value as ArrayBuffer;
  upsert(ctx, id, new DataView(buffer, offset, length));
}

async function deserializeMap(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Map);
  upsert(ctx, id, new Map());
}

async function deserializeMapSet(ctx: DeserializerContext) {
  const map = (await deserializeRef(ctx)).value as Map<unknown, unknown>;
  const index = (await deserializeRef(ctx)).value;
  const value = (await deserializeRef(ctx)).value;
  map.set(index, value);
}

async function deserializeSet(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Set);
  upsert(ctx, id, new Set());
}

async function deserializeSetAdd(ctx: DeserializerContext) {
  const set = (await deserializeRef(ctx)).value as Set<unknown>;
  const value = (await deserializeRef(ctx)).value;
  set.add(value);
}

async function deserializePromise(ctx: DeserializerContext) {
  const promise = await deserializeId(ctx, SerovalNodeType.Promise);

  const instance = PROMISE_CONSTRUCTOR();
  ctx.resolvers.set(promise, instance);
  upsert(ctx, promise, instance.p);
}

async function deserializePromiseSuccess(ctx: DeserializerContext) {
  const resolverIndex = await deserializeInteger(ctx);
  const currentResolver = ctx.resolvers.get(resolverIndex);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryError();
  }
  const value = (await deserializeRef(ctx)).value;
  currentResolver.s(value);
}

async function deserializePromiseFailure(ctx: DeserializerContext) {
  const resolverIndex = await deserializeInteger(ctx);
  const currentResolver = ctx.resolvers.get(resolverIndex);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryError();
  }
  const value = (await deserializeRef(ctx)).value;
  currentResolver.f(value);
}

async function deserializeRegExp(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.RegExp);
  const pattern = (await deserializeRef(ctx)).value as string;
  const flags = (await deserializeRef(ctx)).value as string;
  upsert(ctx, id, new RegExp(pattern, flags));
}

async function deserializeAggregateError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.AggregateError);
  const message = (await deserializeRef(ctx)).value as string;
  upsert(ctx, id, new AggregateError([], message));
}

async function deserializePlugin(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalNodeType.Plugin);
  const tag = (await deserializeRef(ctx)).value as string;
  const options = (await deserializeRef(ctx)).value as string;

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
  const reference = await deserializeRef(ctx);
  ctx.root.s(reference);
}

async function deserializeChunk(ctx: DeserializerContext) {
  // Read first byte
  const firstByte = (await deserializeByte(ctx)) as SerovalNodeType;

  switch (firstByte) {
    case SerovalNodeType.Constant:
      await deserializeConstant(ctx);
      break;
    case SerovalNodeType.Number:
      await deserializeNumber(ctx);
      break;
    case SerovalNodeType.String:
      await deserializeString(ctx);
      break;
    case SerovalNodeType.BigInt:
      await deserializeBigint(ctx);
      break;
    case SerovalNodeType.WKSymbol:
      await deserializeWKSymbol(ctx);
      break;
    case SerovalNodeType.ObjectAssign:
      await deserializeObjectAssign(ctx);
      break;
    case SerovalNodeType.ArrayAssign:
      await deserializeArrayAssign(ctx);
      break;
    case SerovalNodeType.ObjectFlag:
      await deserializeObjectFlag(ctx);
      break;
    case SerovalNodeType.Array:
      await deserializeArray(ctx);
      break;
    case SerovalNodeType.Stream:
      await deserializeStream(ctx);
      break;
    case SerovalNodeType.StreamNext:
      await deserializeStreamNext(ctx);
      break;
    case SerovalNodeType.StreamThrow:
      await deserializeStreamThrow(ctx);
      break;
    case SerovalNodeType.StreamReturn:
      await deserializeStreamReturn(ctx);
      break;
    case SerovalNodeType.Sequence:
      await deserializeSequence(ctx);
      break;
    case SerovalNodeType.SequencePush:
      await deserializeSequencePush(ctx);
      break;
    case SerovalNodeType.Object:
      await deserializeObject(ctx);
      break;
    case SerovalNodeType.NullConstructor:
      await deserializeNullConstructor(ctx);
      break;
    case SerovalNodeType.Date:
      await deserializeDate(ctx);
      break;
    case SerovalNodeType.Error:
      await deserializeError(ctx);
      break;
    case SerovalNodeType.Boxed:
      await deserializeBoxed(ctx);
      break;
    case SerovalNodeType.ArrayBuffer:
      await deserializeArrayBuffer(ctx);
      break;
    case SerovalNodeType.TypedArray:
      await deserializeTypedArray(ctx);
      break;
    case SerovalNodeType.BigIntTypedArray:
      await deserializeBigIntTypedArray(ctx);
      break;
    case SerovalNodeType.DataView:
      await deserializeDataView(ctx);
      break;
    case SerovalNodeType.Map:
      await deserializeMap(ctx);
      break;
    case SerovalNodeType.MapSet:
      await deserializeMapSet(ctx);
      break;
    case SerovalNodeType.Set:
      await deserializeSet(ctx);
      break;
    case SerovalNodeType.SetAdd:
      await deserializeSetAdd(ctx);
      break;
    case SerovalNodeType.Promise:
      await deserializePromise(ctx);
      break;
    case SerovalNodeType.PromiseSuccess:
      await deserializePromiseSuccess(ctx);
      break;
    case SerovalNodeType.PromiseFailure:
      await deserializePromiseFailure(ctx);
      break;
    case SerovalNodeType.RegExp:
      await deserializeRegExp(ctx);
      break;
    case SerovalNodeType.AggregateError:
      await deserializeAggregateError(ctx);
      break;
    case SerovalNodeType.Plugin:
      await deserializePlugin(ctx);
      break;
    case SerovalNodeType.Root:
      await deserializeRoot(ctx);
      break;
    default:
      throw new SerovalMalformedBinaryError();
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
  void drain(ctx).catch(error => {
    console.error(error);
  });
  return ctx.root.p;
}
