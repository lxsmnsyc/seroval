import { ALL_ENABLED, Feature } from '../core/compat';
import {
  BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
  type BigIntTypedArrayTag,
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
  SerovalMissingBinaryRefError,
  SerovalMissingPluginError,
  SerovalUnexpectedBinaryTypeError,
  SerovalUnknownBinaryTypeError,
} from '../core/errors';
import type { PluginWithBinaryMode } from '../core/plugin';
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

const MAX_REGEXP_SOURCE_LENGTH = 20_000;

export interface ReferenceMap {
  // Map id to deserialized value
  values: Map<number, Promise<{ value: unknown }>>;
  // Map id to its encoded type
  types: Map<number, SerovalBinaryType>;
  // a hidden resolver map for Promises
  resolvers: Map<number, PromiseConstructorResolver>;
  // Tracks pending sub nodes
  pendings: Map<number, number>;
}

export function createReferenceMap(): ReferenceMap {
  return {
    values: new Map(),
    types: new Map(),
    resolvers: new Map(),
    pendings: new Map(),
  };
}

export interface DeserializerContextOptions {
  read(): Promise<Uint8Array | undefined>;
  onError(error: unknown): void;
  refs: ReferenceMap;
  plugins?: PluginWithBinaryMode<any, any, any>[];
  disabledFeatures?: number;
  features?: number;
}

export interface DeserializerContext {
  read(): Promise<Uint8Array | undefined>;
  onError(error: unknown): void;
  refs: ReferenceMap;
  plugins?: PluginWithBinaryMode<any, any, any>[];
  root: {
    resolver: PromiseConstructorResolver;
    found: boolean;
    id: number | undefined;
  };
  done: boolean;
  buffer: Uint8Array;
  endianness: SerovalEndianness;
  features: number;
}

export function createDeserializerContext(
  options: DeserializerContextOptions,
): DeserializerContext {
  return {
    read: options.read,
    onError: options.onError,
    refs: options.refs,
    plugins: options.plugins,
    features: options.features ?? ALL_ENABLED ^ (options.disabledFeatures || 0),
    done: false,
    buffer: new Uint8Array(),
    root: {
      resolver: PROMISE_CONSTRUCTOR(),
      found: false,
      id: undefined,
    },
    endianness: SerovalEndianness.LE,
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

function upsert(
  ctx: DeserializerContext,
  id: number,
  value: Promise<{ value: unknown }>,
) {
  ctx.refs.values.set(id, value);
}

async function deserializeId(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
): Promise<number> {
  // parse ID
  const id = await deserializeUint(ctx);
  // Mark id
  ctx.refs.types.set(id, type);
  return id;
}

async function deserializeRef(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  expected: SerovalBinaryType,
) {
  const ref = await deserializeUint(ctx);
  if (expected != null) {
    const marker = ctx.refs.types.get(ref);
    if (marker == null) {
      throw new SerovalMalformedBinaryTypeError(type);
    }
    if (marker !== expected) {
      throw new SerovalUnexpectedBinaryTypeError(type, expected, marker);
    }
  }
  return ref;
}

function getRef(ctx: DeserializerContext, ref: number) {
  if (ctx.refs.values.has(ref)) {
    return ctx.refs.values.get(ref)!;
  }
  throw new SerovalMissingBinaryRefError(ref);
}

function invalidatePending(ctx: DeserializerContext, id: number) {
  const resolver = ctx.refs.resolvers.get(id);
  if (resolver) {
    const current = ctx.refs.pendings.get(id) ?? 0;
    if (current === 0) {
      resolver.s(true);
    }
  }
}

function popPendingState(ctx: DeserializerContext, id: number) {
  const current = ctx.refs.pendings.get(id) ?? 0;
  ctx.refs.pendings.set(id, current - 1);

  invalidatePending(ctx, id);
}

function createPending(ctx: DeserializerContext, id: number) {
  ctx.refs.resolvers.set(id, PROMISE_CONSTRUCTOR());
}

async function deserializePending(ctx: DeserializerContext) {
  const id = await deserializeUint(ctx);
  const amount = await deserializeUint(ctx);

  const current = ctx.refs.pendings.get(id) ?? 0;
  ctx.refs.pendings.set(id, current + amount);

  invalidatePending(ctx, id);
}

function createImmediateTask(value: unknown) {
  return Promise.resolve({
    value,
  });
}

async function deserializeConstant(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Constant);
  const byte = (await deserializeByte(ctx)) as SerovalConstant;
  upsert(ctx, id, createImmediateTask(byte));
}

async function deserializeNumber(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Number);
  const value = await deserializeNumberValue(ctx);
  upsert(ctx, id, createImmediateTask(value));
}

async function deserializeString(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.String);
  // First, ensure that there's an encoded length
  const length = await deserializeUint(ctx);
  // Ensure the next chunk is based on encoded length
  const encodedData = await ensureChunk(ctx, length);
  upsert(ctx, id, createImmediateTask(decodeString(encodedData)));
}

async function deserializeBigintInner(
  ctx: DeserializerContext,
  sign: number,
  stringRef: number,
) {
  const content = (await getRef(ctx, stringRef)).value as string;
  const value = decodeBigint(content);
  return {
    value: sign ? -value : value,
  };
}

async function deserializeBigint(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.BigInt);
  const sign = await deserializeByte(ctx);
  const stringRef = await deserializeRef(
    ctx,
    SerovalBinaryType.BigInt,
    SerovalBinaryType.String,
  );
  // Check if the value exists
  upsert(ctx, id, deserializeBigintInner(ctx, sign, stringRef));
}

async function deserializeWKSymbol(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.WKSymbol);
  const byte = (await deserializeByte(ctx)) as Symbols;
  upsert(
    ctx,
    id,
    createImmediateTask(
      deserializeKnownValue(SerovalBinaryType.WKSymbol, SYMBOL_REF, byte),
    ),
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

async function deserializeObjectAssignInner(
  ctx: DeserializerContext,
  id: number,
  key: number,
  value: number,
) {
  const awaited = await Promise.all([
    getRef(ctx, id),
    getRef(ctx, key),
    getRef(ctx, value),
  ]);
  assignProperty(
    awaited[0].value as Record<string, unknown>,
    awaited[1].value as string,
    awaited[2].value,
  );

  popPendingState(ctx, id);
}

async function deserializeObjectAssign(ctx: DeserializerContext) {
  const object = await deserializeUint(ctx);
  const key = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  deserializeObjectAssignInner(ctx, object, key, value).catch(ctx.onError);
}

async function deserializeArrayAssignInner(
  ctx: DeserializerContext,
  id: number,
  index: number,
  value: number,
) {
  const awaited = await Promise.all([getRef(ctx, id), getRef(ctx, value)]);

  (awaited[0].value as unknown[])[index] = awaited[1].value;

  console.log(awaited);

  popPendingState(ctx, id);
}

async function deserializeArrayAssign(ctx: DeserializerContext) {
  const object = await deserializeRef(
    ctx,
    SerovalBinaryType.ArrayAssign,
    SerovalBinaryType.Array,
  );
  const key = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  deserializeArrayAssignInner(ctx, object, key, value).catch(ctx.onError);
}

async function deserializeObjectFlagInner(
  ctx: DeserializerContext,
  id: number,
  flag: SerovalObjectFlags,
) {
  const resolver = ctx.refs.resolvers.get(id);
  if (resolver) {
    await resolver.p;
    const object = (await getRef(ctx, id)).value;
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
    return;
  }
  throw new SerovalMalformedBinarySourceError();
}

async function deserializeObjectFlag(ctx: DeserializerContext) {
  const object = await deserializeUint(ctx);
  const flag = (await deserializeByte(ctx)) as SerovalObjectFlags;

  // TODO pending state
  deserializeObjectFlagInner(ctx, object, flag).catch(ctx.onError);
}

async function deserializeArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Array);
  const length = await deserializeUint(ctx);
  createPending(ctx, id);
  upsert(ctx, id, createImmediateTask(new Array(length)));
}

async function deserializeStream(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Stream);
  upsert(ctx, id, createImmediateTask(createStream()));
}

async function deserializeStreamNextInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const awaited = await Promise.all([getRef(ctx, stream), getRef(ctx, value)]);

  (awaited[0].value as Stream<unknown>).next(awaited[1].value);
}

async function deserializeStreamNext(ctx: DeserializerContext) {
  const stream = await deserializeRef(
    ctx,
    SerovalBinaryType.StreamNext,
    SerovalBinaryType.Stream,
  );
  const value = await deserializeUint(ctx);
  deserializeStreamNextInner(ctx, stream, value).catch(ctx.onError);
}

async function deserializeStreamThrowInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const awaited = await Promise.all([getRef(ctx, stream), getRef(ctx, value)]);

  (awaited[0].value as Stream<unknown>).throw(awaited[1].value);
}

async function deserializeStreamThrow(ctx: DeserializerContext) {
  const stream = await deserializeRef(
    ctx,
    SerovalBinaryType.StreamThrow,
    SerovalBinaryType.Stream,
  );
  const value = await deserializeUint(ctx);
  deserializeStreamThrowInner(ctx, stream, value).catch(ctx.onError);
}

async function deserializeStreamReturnInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const awaited = await Promise.all([getRef(ctx, stream), getRef(ctx, value)]);

  (awaited[0].value as Stream<unknown>).throw(awaited[1].value);
}

async function deserializeStreamReturn(ctx: DeserializerContext) {
  const stream = await deserializeRef(
    ctx,
    SerovalBinaryType.StreamReturn,
    SerovalBinaryType.Stream,
  );
  const value = await deserializeUint(ctx);
  deserializeStreamReturnInner(ctx, stream, value).catch(ctx.onError);
}

async function deserializeSequence(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Sequence);
  const throwAt = await deserializeInt(ctx);
  const doneAt = await deserializeInt(ctx);
  upsert(ctx, id, createImmediateTask(createSequence([], throwAt, doneAt)));
}
async function deserializeSequencePushInner(
  ctx: DeserializerContext,
  sequence: number,
  value: number,
) {
  const awaited = await Promise.all([
    getRef(ctx, sequence),
    getRef(ctx, value),
  ]);

  (awaited[0].value as Sequence).v.push(awaited[1].value);

  popPendingState(ctx, sequence);
}

async function deserializeSequencePush(ctx: DeserializerContext) {
  const sequence = await deserializeRef(
    ctx,
    SerovalBinaryType.SequencePush,
    SerovalBinaryType.Sequence,
  );
  const value = await deserializeUint(ctx);
  deserializeSequencePushInner(ctx, sequence, value).catch(ctx.onError);
}

async function deserializeObject(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Object);
  createPending(ctx, id);
  upsert(ctx, id, createImmediateTask({}));
}

async function deserializeNullConstructor(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.NullConstructor);
  createPending(ctx, id);
  upsert(ctx, id, createImmediateTask(Object.create(null)));
}

async function deserializeDate(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Date);
  const timestamp = await deserializeNumberValue(ctx);
  upsert(ctx, id, createImmediateTask(new Date(timestamp)));
}

async function deserializeErrorInner(
  ctx: DeserializerContext,
  tag: ErrorConstructorTag,
  message: number,
) {
  const construct = deserializeKnownValue(
    SerovalBinaryType.Error,
    ERROR_CONSTRUCTOR,
    tag,
  );

  return {
    value: new construct((await getRef(ctx, message)).value as string),
  };
}

async function deserializeError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Error);
  const tag = (await deserializeByte(ctx)) as ErrorConstructorTag;
  const message = await deserializeRef(
    ctx,
    SerovalBinaryType.Error,
    SerovalBinaryType.String,
  );
  upsert(ctx, id, deserializeErrorInner(ctx, tag, message));
}

async function deserializeBoxedInner(ctx: DeserializerContext, value: number) {
  return {
    // biome-ignore lint/style/useConsistentBuiltinInstantiation: intentional
    value: Object((await getRef(ctx, value)).value),
  };
}

async function deserializeBoxed(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Boxed);
  const value = await deserializeUint(ctx);
  upsert(ctx, id, deserializeBoxedInner(ctx, value));
}

async function deserializeArrayBuffer(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.ArrayBuffer);
  const length = await deserializeUint(ctx);
  const bytes = await ensureChunk(ctx, length);
  upsert(ctx, id, createImmediateTask(bytes.buffer));
}

async function deserializeTypedArrayInner(
  ctx: DeserializerContext,
  tag: TypedArrayTag,
  buffer: number,
  offset: number,
  length: number,
) {
  const construct = deserializeKnownValue(
    SerovalBinaryType.TypedArray,
    TYPED_ARRAY_CONSTRUCTOR,
    tag,
  );

  return {
    value: new construct(
      (await getRef(ctx, buffer)).value as ArrayBuffer,
      offset,
      length,
    ),
  };
}

async function deserializeTypedArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.TypedArray);
  const tag = (await deserializeByte(ctx)) as TypedArrayTag;
  const buffer = await deserializeRef(
    ctx,
    SerovalBinaryType.TypedArray,
    SerovalBinaryType.ArrayBuffer,
  );
  const offset = await deserializeUint(ctx);
  const length = await deserializeUint(ctx);
  upsert(ctx, id, deserializeTypedArrayInner(ctx, tag, buffer, offset, length));
}

async function deserializeBigIntTypedArrayInner(
  ctx: DeserializerContext,
  tag: BigIntTypedArrayTag,
  buffer: number,
  offset: number,
  length: number,
) {
  const construct = deserializeKnownValue(
    SerovalBinaryType.BigIntTypedArray,
    BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
    tag,
  );

  return {
    value: new construct(
      (await getRef(ctx, buffer)).value as ArrayBuffer,
      offset,
      length,
    ),
  };
}

async function deserializeBigIntTypedArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.BigIntTypedArray);
  const tag = (await deserializeByte(ctx)) as BigIntTypedArrayTag;
  const buffer = await deserializeRef(
    ctx,
    SerovalBinaryType.BigIntTypedArray,
    SerovalBinaryType.ArrayBuffer,
  );
  const offset = await deserializeUint(ctx);
  const length = await deserializeUint(ctx);
  upsert(
    ctx,
    id,
    deserializeBigIntTypedArrayInner(ctx, tag, buffer, offset, length),
  );
}

async function deserializeDataViewInner(
  ctx: DeserializerContext,
  buffer: number,
  offset: number,
  length: number,
) {
  return {
    value: new DataView(
      (await getRef(ctx, buffer)).value as ArrayBuffer,
      offset,
      length,
    ),
  };
}

async function deserializeDataView(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.DataView);
  const buffer = await deserializeRef(
    ctx,
    SerovalBinaryType.DataView,
    SerovalBinaryType.ArrayBuffer,
  );
  const offset = await deserializeUint(ctx);
  const length = await deserializeUint(ctx);
  upsert(ctx, id, deserializeDataViewInner(ctx, buffer, offset, length));
}

async function deserializeMap(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Map);
  upsert(ctx, id, createImmediateTask(new Map()));
}

async function deserializeMapSetInner(
  ctx: DeserializerContext,
  id: number,
  key: number,
  value: number,
) {
  const awaited = await Promise.all([
    getRef(ctx, id),
    getRef(ctx, key),
    getRef(ctx, value),
  ]);
  (awaited[0].value as Map<unknown, unknown>).set(
    awaited[1].value,
    awaited[2].value,
  );

  popPendingState(ctx, id);
}

async function deserializeMapSet(ctx: DeserializerContext) {
  const object = await deserializeRef(
    ctx,
    SerovalBinaryType.MapSet,
    SerovalBinaryType.Map,
  );
  const key = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  deserializeMapSetInner(ctx, object, key, value).catch(ctx.onError);
}

async function deserializeSet(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Set);
  upsert(ctx, id, createImmediateTask(new Set()));
}

async function deserializeSetAddInner(
  ctx: DeserializerContext,
  id: number,
  value: number,
) {
  const awaited = await Promise.all([getRef(ctx, id), getRef(ctx, value)]);
  (awaited[0].value as Set<unknown>).add(awaited[1].value);

  popPendingState(ctx, id);
}

async function deserializeSetAdd(ctx: DeserializerContext) {
  const object = await deserializeRef(
    ctx,
    SerovalBinaryType.SetAdd,
    SerovalBinaryType.Set,
  );
  const value = await deserializeUint(ctx);

  deserializeSetAddInner(ctx, object, value).catch(ctx.onError);
}

async function deserializePromise(ctx: DeserializerContext) {
  const promise = await deserializeId(ctx, SerovalBinaryType.Promise);

  const instance = PROMISE_CONSTRUCTOR();
  ctx.refs.resolvers.set(promise, instance);
  upsert(ctx, promise, createImmediateTask(instance.p));
}

async function deserializePromiseSuccessInner(
  ctx: DeserializerContext,
  resolver: number,
  value: number,
) {
  const currentResolver = ctx.refs.resolvers.get(resolver);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseSuccess);
  }
  currentResolver.s((await getRef(ctx, value)).value);
}

async function deserializePromiseSuccess(ctx: DeserializerContext) {
  const resolver = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  deserializePromiseSuccessInner(ctx, resolver, value).catch(ctx.onError);
}

async function deserializePromiseFailureInner(
  ctx: DeserializerContext,
  resolver: number,
  value: number,
) {
  const currentResolver = ctx.refs.resolvers.get(resolver);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseFailure);
  }
  currentResolver.f((await getRef(ctx, value)).value);
}

async function deserializePromiseFailure(ctx: DeserializerContext) {
  const resolver = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  deserializePromiseFailureInner(ctx, resolver, value).catch(ctx.onError);
}

async function deserializeRegExpInner(
  ctx: DeserializerContext,
  pattern: number,
  flags: number,
) {
  const awaited = await Promise.all([getRef(ctx, pattern), getRef(ctx, flags)]);

  const actualPattern = awaited[0].value as string;
  if (actualPattern.length > MAX_REGEXP_SOURCE_LENGTH) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.RegExp);
  }
  const actualFlags = awaited[1].value as string;

  return {
    value: new RegExp(actualPattern, actualFlags),
  };
}

async function deserializeRegExp(ctx: DeserializerContext) {
  if (!(ctx.features & Feature.RegExp)) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.RegExp);
  }
  const id = await deserializeId(ctx, SerovalBinaryType.RegExp);
  const pattern = await deserializeRef(
    ctx,
    SerovalBinaryType.RegExp,
    SerovalBinaryType.String,
  );
  const flags = await deserializeRef(
    ctx,
    SerovalBinaryType.RegExp,
    SerovalBinaryType.String,
  );
  upsert(ctx, id, deserializeRegExpInner(ctx, pattern, flags));
}

async function deserializeAggregateErrorInner(
  ctx: DeserializerContext,
  message: number,
) {
  return {
    value: new AggregateError([], (await getRef(ctx, message)).value as string),
  };
}

async function deserializeAggregateError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.AggregateError);
  const message = await deserializeRef(
    ctx,
    SerovalBinaryType.AggregateError,
    SerovalBinaryType.String,
  );
  upsert(ctx, id, deserializeAggregateErrorInner(ctx, message));
}

async function deserializePluginInner(
  ctx: DeserializerContext,
  tag: number,
  options: number,
) {
  const awaited = await Promise.all([getRef(ctx, tag), getRef(ctx, options)]);

  const actualTag = awaited[0].value as string;
  const actualOptions = awaited[1].value;

  if (ctx.plugins) {
    for (let i = 0, len = ctx.plugins.length; i < len; i++) {
      const current = ctx.plugins[i];
      if (current.tag === actualTag) {
        return {
          value: await current.binary.deserialize(actualOptions),
        };
      }
    }
  }
  throw new SerovalMissingPluginError(actualTag);
}

async function deserializePlugin(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Plugin);
  const tag = await deserializeRef(
    ctx,
    SerovalBinaryType.Plugin,
    SerovalBinaryType.String,
  );
  const options = await deserializeUint(ctx);

  upsert(ctx, id, deserializePluginInner(ctx, tag, options));
}

async function deserializeRootInner(ctx: DeserializerContext, ref: number) {
  // first, check for resolvers
  const resolver = ctx.refs.resolvers.get(ref);
  // If there's a resolver, we use that first
  if (resolver) {
    ctx.root.found = true;
    await resolver.p;
  }
  if (ctx.refs.values.has(ref)) {
    ctx.root.found = true;
    ctx.root.resolver.s(ctx.refs.values.get(ref));
  } else {
    // we might be earlier
    ctx.root.id = ref;
  }
}

async function deserializeRoot(ctx: DeserializerContext) {
  const ref = await deserializeUint(ctx);
  deserializeRootInner(ctx, ref);
}

async function deserializeIteratorInner(
  ctx: DeserializerContext,
  sequence: number,
) {
  return {
    value: sequenceToIterator((await getRef(ctx, sequence)).value as Sequence),
  };
}

async function deserializeIterator(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Iterator);
  const sequence = await deserializeRef(
    ctx,
    SerovalBinaryType.Iterator,
    SerovalBinaryType.Sequence,
  );
  upsert(ctx, id, deserializeIteratorInner(ctx, sequence));
}

async function deserializeAsyncIteratorInner(
  ctx: DeserializerContext,
  stream: number,
) {
  return {
    value: streamToAsyncIterable(
      (await getRef(ctx, stream)).value as Stream<unknown>,
    ),
  };
}

async function deserializeAsyncIterator(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.AsyncIterator);
  const stream = await deserializeRef(
    ctx,
    SerovalBinaryType.AsyncIterator,
    SerovalBinaryType.Stream,
  );
  upsert(ctx, id, deserializeAsyncIteratorInner(ctx, stream));
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
    case SerovalBinaryType.Pending:
      await deserializePending(ctx);
      break;
    default:
      throw new SerovalUnknownBinaryTypeError(firstByte);
  }
}

async function drain(ctx: DeserializerContext) {
  while (true) {
    if (ctx.buffer.length === 0) {
      if (ctx.done) {
        if (ctx.root.found) {
          return;
        }
        throw new SerovalMalformedBinarySourceError();
      }
      await readChunk(ctx);
    } else {
      await deserializeChunk(ctx);
    }
  }
}

export function deserializeStart(ctx: DeserializerContext) {
  void drain(ctx).catch(ctx.onError);
  return ctx.root.resolver.p;
}
