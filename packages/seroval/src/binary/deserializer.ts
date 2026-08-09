import { ALL_ENABLED, Feature } from '../core/compat';
import {
  BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
  type BigIntTypedArrayTag,
  CONSTANT_VAL,
  ERROR_CONSTRUCTOR,
  type ErrorConstructorTag,
  type SerovalConstant,
  SerovalObjectFlags,
  SerovalTemporalType,
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

// The join state of a container: how many child assignments are still
// outstanding, and a resolver that fires once the count reaches zero.
interface PendingState {
  count: number;
  resolver: PromiseConstructorResolver;
}

export interface ReferenceMap {
  // Map id to its deserialized value. Identity is known synchronously for
  // every node except a Plugin, so the value is stored raw - no promise, no
  // box - and read back synchronously via `getRefSync`.
  values: Map<number, unknown>;
  // Ids whose identity is not yet known: a Plugin whose `deserialize` has not
  // returned. Its promise resolves to the raw value, which is also written
  // into `values` on completion.
  deferred: Map<number, Promise<unknown>>;
  // Map id to its encoded type
  types: Map<number, SerovalBinaryType>;
  // Resolvers for Promise nodes: the real, user-facing settle.
  promiseResolvers: Map<number, PromiseConstructorResolver>;
  // Join state for containers: outstanding child count plus its resolver.
  // Disjoint from `promiseResolvers` - a Promise is never a container and a
  // container is never a Promise - so neither one has to be told apart from
  // the other by its node type.
  pendingResolvers: Map<number, PendingState>;
  // Maps a container id to the ids it holds, so a subtree can be awaited
  children: Map<number, number[]>;
}

export function createReferenceMap(): ReferenceMap {
  return {
    values: new Map(),
    deferred: new Map(),
    types: new Map(),
    promiseResolvers: new Map(),
    pendingResolvers: new Map(),
    children: new Map(),
  };
}

export interface DeserializerContextOptions {
  read(): Promise<Uint8Array | undefined>;
  onError(error: unknown): void;
  refs?: ReferenceMap;
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
    refs: options.refs || createReferenceMap(),
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

function isThenable(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    'then' in value &&
    typeof value.then === 'function'
  );
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

function upsert(ctx: DeserializerContext, id: number, value: unknown) {
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

/**
 * Same as {@link deserializeRef}, for the nodes that legitimately accept more
 * than one target type. Untrusted input must never be able to aim an operation
 * node at a node type the serializer would never pair it with.
 */
async function deserializeRefOf(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  expected: SerovalBinaryType[],
) {
  const ref = await deserializeUint(ctx);
  const marker = ctx.refs.types.get(ref);
  if (marker == null) {
    throw new SerovalMalformedBinaryTypeError(type);
  }
  if (expected.indexOf(marker) === -1) {
    throw new SerovalUnexpectedBinaryTypeError(type, expected[0], marker);
  }
  return ref;
}

// The serializer only emits properties for these node types.
const PROPERTY_TARGETS = [
  SerovalBinaryType.Object,
  SerovalBinaryType.NullConstructor,
  SerovalBinaryType.Error,
  SerovalBinaryType.AggregateError,
];

// ...and only tracks object flags for these.
const FLAG_TARGETS = [
  SerovalBinaryType.Object,
  SerovalBinaryType.NullConstructor,
  SerovalBinaryType.Array,
];

// ...and only counts pending sub-nodes for these. A Promise must not be in
// this list: its resolver lives in the same table and settling it here would
// hand the consumer `true` instead of the serialized value.
const PENDING_TARGETS = [
  SerovalBinaryType.Object,
  SerovalBinaryType.NullConstructor,
  SerovalBinaryType.Array,
  SerovalBinaryType.Sequence,
  SerovalBinaryType.Map,
  SerovalBinaryType.Set,
  SerovalBinaryType.Error,
  SerovalBinaryType.AggregateError,
];

function trackChild(
  ctx: DeserializerContext,
  parent: number,
  child: number,
): void {
  const current = ctx.refs.children.get(parent);
  if (current) {
    current.push(child);
  } else {
    ctx.refs.children.set(parent, [child]);
  }
}

/**
 * Waits until every container reachable from `id` has applied all of its
 * assignments. A node's ref resolves with its *shell* as early as possible so
 * that cycles can be built at all, which means a freshly resolved container
 * may still be empty; this is how a consumer waits for the real thing.
 *
 * Promise and Stream nodes are deliberately not awaited: they are the parts of
 * the format that are meant to stay open after the value is handed over.
 *
 * `owner` is the plugin id whose payload is being materialized, if any. A
 * container inside that payload holding the plugin's own value can never
 * settle - that value is what we are building - so it is stepped over. A
 * payload of plugin A holding plugin B whose payload holds A is beyond that
 * guard and is not supported.
 */
async function awaitSubtree(
  ctx: DeserializerContext,
  id: number,
  owner?: number,
): Promise<void> {
  const seen = new Set<number>([id]);
  const queue = [id];

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    // Only containers have a pending resolver, so no node-type check is
    // needed to keep a Promise out of this wait.
    const entry = ctx.refs.pendingResolvers.get(current);
    if (entry) {
      const held = ctx.refs.children.get(current);
      let blocked = false;
      if (held && owner != null) {
        blocked = held.indexOf(owner) !== -1;
      }
      if (!blocked) {
        await entry.resolver.p;
      }
    }
    // Re-read: more assignments may have been parsed while awaiting.
    const children = ctx.refs.children.get(current);
    if (children) {
      for (let j = 0, len = children.length; j < len; j++) {
        const child = children[j];
        if (!seen.has(child)) {
          seen.add(child);
          queue.push(child);
        }
      }
    }
  }
}

// The value's identity is present the moment its node is parsed, and a ref is
// always declared before it is used, so the common read is synchronous.
function getRefSync(ctx: DeserializerContext, ref: number): unknown {
  if (ctx.refs.values.has(ref)) {
    return ctx.refs.values.get(ref);
  }
  throw new SerovalMissingBinaryRefError(ref);
}

// Used only where a slot may hold a Plugin, whose identity resolves later.
function getRefAsync(ctx: DeserializerContext, ref: number): Promise<unknown> {
  const pending = ctx.refs.deferred.get(ref);
  if (pending) {
    return pending;
  }
  if (ctx.refs.values.has(ref)) {
    return Promise.resolve(ctx.refs.values.get(ref));
  }
  throw new SerovalMissingBinaryRefError(ref);
}

function invalidatePending(entry: PendingState) {
  if (entry.count === 0) {
    entry.resolver.s(true);
  }
}

function popPendingState(ctx: DeserializerContext, id: number) {
  const entry = ctx.refs.pendingResolvers.get(id);
  if (entry) {
    entry.count -= 1;
    invalidatePending(entry);
  }
}

function createPending(ctx: DeserializerContext, id: number) {
  ctx.refs.pendingResolvers.set(id, {
    count: 0,
    resolver: PROMISE_CONSTRUCTOR(),
  });
}

async function deserializePending(ctx: DeserializerContext) {
  const id = await deserializeRefOf(
    ctx,
    SerovalBinaryType.Pending,
    PENDING_TARGETS,
  );
  const amount = await deserializeUint(ctx);

  const entry = ctx.refs.pendingResolvers.get(id);
  if (entry) {
    entry.count += amount;
    invalidatePending(entry);
  }
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
  const value = await deserializeNumberValue(ctx);
  upsert(ctx, id, value);
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
  const sign = await deserializeByte(ctx);
  const stringRef = await deserializeRef(
    ctx,
    SerovalBinaryType.BigInt,
    SerovalBinaryType.String,
  );
  const value = decodeBigint(getRefSync(ctx, stringRef) as string);
  upsert(ctx, id, sign ? -value : value);
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

// Applies one child assignment and releases its container's pending count.
// The value read is synchronous unless the value is a still-building Plugin,
// in which case the write is deferred until that plugin resolves. Either way
// the count is released - a failed assignment must not hang the container.
function runAssignment(
  ctx: DeserializerContext,
  container: number,
  valueRef: number,
  apply: (value: unknown) => void,
): void {
  const pending = ctx.refs.deferred.get(valueRef);
  if (pending) {
    pending.then(
      value => {
        try {
          apply(value);
        } catch (err) {
          ctx.onError(err);
        } finally {
          popPendingState(ctx, container);
        }
      },
      err => {
        ctx.onError(err);
        popPendingState(ctx, container);
      },
    );
    return;
  }
  try {
    apply(getRefSync(ctx, valueRef));
  } catch (err) {
    ctx.onError(err);
  } finally {
    popPendingState(ctx, container);
  }
}

async function deserializeObjectAssign(ctx: DeserializerContext) {
  const object = await deserializeRefOf(
    ctx,
    SerovalBinaryType.ObjectAssign,
    PROPERTY_TARGETS,
  );
  const key = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  trackChild(ctx, object, value);
  runAssignment(ctx, object, value, resolved => {
    assignProperty(
      getRefSync(ctx, object) as Record<string, unknown>,
      getRefSync(ctx, key) as string,
      resolved,
    );
  });
}

async function deserializeArrayAssign(ctx: DeserializerContext) {
  const object = await deserializeRef(
    ctx,
    SerovalBinaryType.ArrayAssign,
    SerovalBinaryType.Array,
  );
  const index = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  trackChild(ctx, object, value);
  runAssignment(ctx, object, value, resolved => {
    (getRefSync(ctx, object) as unknown[])[index] = resolved;
  });
}

async function deserializeObjectFlagInner(
  ctx: DeserializerContext,
  id: number,
  flag: SerovalObjectFlags,
) {
  const entry = ctx.refs.pendingResolvers.get(id);
  if (entry) {
    await entry.resolver.p;
    const object = getRefSync(ctx, id);
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
  const object = await deserializeRefOf(
    ctx,
    SerovalBinaryType.ObjectFlag,
    FLAG_TARGETS,
  );
  const flag = (await deserializeByte(ctx)) as SerovalObjectFlags;

  // TODO pending state
  deserializeObjectFlagInner(ctx, object, flag).catch(ctx.onError);
}

async function deserializeArray(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Array);
  const length = await deserializeUint(ctx);
  createPending(ctx, id);
  upsert(ctx, id, new Array(length));
}

async function deserializeStream(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Stream);
  upsert(ctx, id, createStream());
}

async function deserializeStreamNextInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const s = getRefSync(ctx, stream) as Stream<unknown>;
  s.next(await getRefAsync(ctx, value));
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
  const s = getRefSync(ctx, stream) as Stream<unknown>;
  s.throw(await getRefAsync(ctx, value));
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
  const s = getRefSync(ctx, stream) as Stream<unknown>;
  s.return(await getRefAsync(ctx, value));
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
  createPending(ctx, id);
  upsert(ctx, id, createSequence([], throwAt, doneAt));
}
async function deserializeSequencePush(ctx: DeserializerContext) {
  const sequence = await deserializeRef(
    ctx,
    SerovalBinaryType.SequencePush,
    SerovalBinaryType.Sequence,
  );
  const value = await deserializeUint(ctx);
  trackChild(ctx, sequence, value);
  runAssignment(ctx, sequence, value, resolved => {
    (getRefSync(ctx, sequence) as Sequence).v.push(resolved);
  });
}

async function deserializeObject(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Object);
  createPending(ctx, id);
  upsert(ctx, id, {});
}

async function deserializeNullConstructor(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.NullConstructor);
  createPending(ctx, id);
  upsert(ctx, id, Object.create(null));
}

async function deserializeDate(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Date);
  const timestamp = await deserializeNumberValue(ctx);
  upsert(ctx, id, new Date(timestamp));
}

async function deserializeError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Error);
  const tag = (await deserializeByte(ctx)) as ErrorConstructorTag;
  const message = await deserializeRef(
    ctx,
    SerovalBinaryType.Error,
    SerovalBinaryType.String,
  );
  const construct = deserializeKnownValue(
    SerovalBinaryType.Error,
    ERROR_CONSTRUCTOR,
    tag,
  );
  upsert(ctx, id, new construct(getRefSync(ctx, message) as string));
}

async function deserializeBoxed(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Boxed);
  const value = await deserializeUint(ctx);
  trackChild(ctx, id, value);
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: intentional
  upsert(ctx, id, Object(getRefSync(ctx, value)));
}

async function deserializeArrayBuffer(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.ArrayBuffer);
  const length = await deserializeUint(ctx);
  const bytes = await ensureChunk(ctx, length);
  upsert(
    ctx,
    id,
    // We can't really use the buffer directly.
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
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
  const construct = deserializeKnownValue(
    SerovalBinaryType.TypedArray,
    TYPED_ARRAY_CONSTRUCTOR,
    tag,
  );
  upsert(
    ctx,
    id,
    new construct(getRefSync(ctx, buffer) as ArrayBuffer, offset, length),
  );
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
  const construct = deserializeKnownValue(
    SerovalBinaryType.BigIntTypedArray,
    BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
    tag,
  );
  upsert(
    ctx,
    id,
    new construct(getRefSync(ctx, buffer) as ArrayBuffer, offset, length),
  );
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
  upsert(
    ctx,
    id,
    new DataView(getRefSync(ctx, buffer) as ArrayBuffer, offset, length),
  );
}

async function deserializeMap(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Map);
  createPending(ctx, id);
  upsert(ctx, id, new Map());
}

// A Map entry is the one assignment with two potentially-deferred refs (a
// plugin can be a key as well as a value), so it cannot reuse `runAssignment`.
function deserializeMapSetEntry(
  ctx: DeserializerContext,
  id: number,
  key: number,
  value: number,
): void {
  const set = (k: unknown, v: unknown) => {
    (getRefSync(ctx, id) as Map<unknown, unknown>).set(k, v);
  };
  if (ctx.refs.deferred.get(key) || ctx.refs.deferred.get(value)) {
    Promise.all([getRefAsync(ctx, key), getRefAsync(ctx, value)]).then(
      ([k, v]) => {
        try {
          set(k, v);
        } catch (err) {
          ctx.onError(err);
        } finally {
          popPendingState(ctx, id);
        }
      },
      err => {
        ctx.onError(err);
        popPendingState(ctx, id);
      },
    );
    return;
  }
  try {
    set(getRefSync(ctx, key), getRefSync(ctx, value));
  } catch (err) {
    ctx.onError(err);
  } finally {
    popPendingState(ctx, id);
  }
}

async function deserializeMapSet(ctx: DeserializerContext) {
  const object = await deserializeRef(
    ctx,
    SerovalBinaryType.MapSet,
    SerovalBinaryType.Map,
  );
  const key = await deserializeUint(ctx);
  const value = await deserializeUint(ctx);

  trackChild(ctx, object, key);
  trackChild(ctx, object, value);
  deserializeMapSetEntry(ctx, object, key, value);
}

async function deserializeSet(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Set);
  createPending(ctx, id);
  upsert(ctx, id, new Set());
}

async function deserializeSetAdd(ctx: DeserializerContext) {
  const object = await deserializeRef(
    ctx,
    SerovalBinaryType.SetAdd,
    SerovalBinaryType.Set,
  );
  const value = await deserializeUint(ctx);

  trackChild(ctx, object, value);
  runAssignment(ctx, object, value, resolved => {
    (getRefSync(ctx, object) as Set<unknown>).add(resolved);
  });
}

async function deserializePromise(ctx: DeserializerContext) {
  const promise = await deserializeId(ctx, SerovalBinaryType.Promise);

  const instance = PROMISE_CONSTRUCTOR();
  ctx.refs.promiseResolvers.set(promise, instance);
  // A Promise node's identity - the user-facing promise object - is known
  // immediately, so it is stored raw like any other value, not deferred.
  upsert(ctx, promise, instance.p);
}

async function deserializePromiseFulfillInner(
  ctx: DeserializerContext,
  success: boolean,
  resolver: number,
  value: number,
) {
  const currentResolver = ctx.refs.promiseResolvers.get(resolver);
  if (currentResolver == null) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseSuccess);
  }
  const resolvingValue = await getRefAsync(ctx, value);
  if (isThenable(resolvingValue)) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseSuccess);
  }
  // Same contract as the root: a settled Promise hands over a finished value.
  await awaitSubtree(ctx, value);
  if (success) {
    currentResolver.s(resolvingValue);
  } else {
    currentResolver.f(resolvingValue);
  }
}

async function deserializePromiseSuccess(ctx: DeserializerContext) {
  // Only Promise ids ever reach `promiseResolvers`, but validating the target
  // type up front turns a wrong reference into a clear error.
  const resolver = await deserializeRef(
    ctx,
    SerovalBinaryType.PromiseSuccess,
    SerovalBinaryType.Promise,
  );
  const value = await deserializeUint(ctx);

  deserializePromiseFulfillInner(ctx, true, resolver, value).catch(ctx.onError);
}

async function deserializePromiseFailure(ctx: DeserializerContext) {
  const resolver = await deserializeRef(
    ctx,
    SerovalBinaryType.PromiseFailure,
    SerovalBinaryType.Promise,
  );
  const value = await deserializeUint(ctx);

  deserializePromiseFulfillInner(ctx, false, resolver, value).catch(
    ctx.onError,
  );
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
  const actualPattern = getRefSync(ctx, pattern) as string;
  if (actualPattern.length > MAX_REGEXP_SOURCE_LENGTH) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.RegExp);
  }
  upsert(ctx, id, new RegExp(actualPattern, getRefSync(ctx, flags) as string));
}

async function deserializeAggregateError(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.AggregateError);
  const message = await deserializeRef(
    ctx,
    SerovalBinaryType.AggregateError,
    SerovalBinaryType.String,
  );
  upsert(
    ctx,
    id,
    new AggregateError([], getRefSync(ctx, message) as string),
  );
}

async function deserializePluginInner(
  ctx: DeserializerContext,
  id: number,
  tag: number,
  options: number,
): Promise<unknown> {
  const actualTag = getRefSync(ctx, tag) as string;

  // A plugin builds a native value out of its payload and most of them copy
  // what they are given (`FormData.append`, `new CustomEvent`, ...), so the
  // payload has to be fully materialized first. Without this a nested async
  // value - a File's bytes, say - is still missing and gets copied as
  // `undefined` with no way to recover.
  await awaitSubtree(ctx, options, id);
  const actualOptions = getRefSync(ctx, options);

  if (ctx.plugins) {
    for (let i = 0, len = ctx.plugins.length; i < len; i++) {
      const current = ctx.plugins[i];
      if (current.tag === actualTag) {
        const value = await current.binary.deserialize(actualOptions);
        // Publish the resolved identity so later synchronous reads (root,
        // `awaitSubtree`) see it, not just consumers awaiting `deferred`. The
        // settled promise also stays in `deferred` for a consumer parsed
        // after this point.
        ctx.refs.values.set(id, value);
        return value;
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

  trackChild(ctx, id, options);
  // A Plugin is the one node whose identity is not known synchronously, so it
  // is registered as deferred; consumers of its value await this promise. It
  // is set before the inner runs so a container holding the plugin sees it as
  // deferred - including the plugin's own payload, which `awaitSubtree` steps
  // over via its `owner` guard.
  const task = deserializePluginInner(ctx, id, tag, options);
  ctx.refs.deferred.set(id, task);
  // Whoever consumes this value (an assignment, the root, a Promise) reports a
  // failure; this only keeps an unconsumed rejection from going unhandled.
  task.catch(() => {
    // handled by the consumer
  });
}

async function deserializeRootInner(ctx: DeserializerContext, ref: number) {
  // A Plugin root has no synchronous identity; wait for it to build.
  const pending = ctx.refs.deferred.get(ref);
  if (pending) {
    ctx.root.found = true;
    try {
      ctx.root.resolver.s({ value: await pending });
    } catch (err) {
      ctx.root.resolver.f(err);
    }
    return;
  }
  // A container root has to be fully joined before it is handed over. Its
  // pending resolver lives in `pendingResolvers`, so no Promise ever matches
  // here - the `awaitSubtree` below waits on the same resolver too, but this
  // marks the root found as early as its own join.
  const entry = ctx.refs.pendingResolvers.get(ref);
  if (entry) {
    ctx.root.found = true;
    await entry.resolver.p;
  }
  if (ctx.refs.values.has(ref)) {
    ctx.root.found = true;
    // Hand the value over materialized: a nested container is only a shell
    // when its own ref resolves.
    await awaitSubtree(ctx, ref);
    ctx.root.resolver.s({ value: getRefSync(ctx, ref) });
  } else {
    // we might be earlier
    ctx.root.id = ref;
  }
}

async function deserializeRoot(ctx: DeserializerContext) {
  const ref = await deserializeUint(ctx);
  deserializeRootInner(ctx, ref).catch(ctx.onError);
}

async function deserializeIterator(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Iterator);
  const sequence = await deserializeRef(
    ctx,
    SerovalBinaryType.Iterator,
    SerovalBinaryType.Sequence,
  );
  trackChild(ctx, id, sequence);
  upsert(ctx, id, sequenceToIterator(getRefSync(ctx, sequence) as Sequence));
}

async function deserializeAsyncIterator(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.AsyncIterator);
  const stream = await deserializeRef(
    ctx,
    SerovalBinaryType.AsyncIterator,
    SerovalBinaryType.Stream,
  );
  upsert(
    ctx,
    id,
    streamToAsyncIterable(getRefSync(ctx, stream) as Stream<unknown>),
  );
}

function deserializeTemporalInner(
  ctx: DeserializerContext,
  type: SerovalTemporalType,
  isoRef: number,
) {
  if (!(ctx.features & Feature.Temporal)) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.Temporal);
  }
  const iso = getRefSync(ctx, isoRef) as string;
  let value: unknown;

  switch (type) {
    case SerovalTemporalType.Instant:
      value = Temporal.Instant.from(iso);
      break;
    case SerovalTemporalType.Duration:
      value = Temporal.Duration.from(iso);
      break;
    case SerovalTemporalType.PlainDate:
      value = Temporal.PlainDate.from(iso);
      break;
    case SerovalTemporalType.PlainDateTime:
      value = Temporal.PlainDateTime.from(iso);
      break;
    case SerovalTemporalType.PlainMonthDay:
      value = Temporal.PlainMonthDay.from(iso);
      break;
    case SerovalTemporalType.PlainTime:
      value = Temporal.PlainTime.from(iso);
      break;
    case SerovalTemporalType.PlainYearMonth:
      value = Temporal.PlainYearMonth.from(iso);
      break;
    case SerovalTemporalType.ZonedDateTime:
      value = Temporal.ZonedDateTime.from(iso);
      break;
    default:
      throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.Temporal);
  }

  return value;
}

async function deserializeTemporal(ctx: DeserializerContext) {
  const id = await deserializeId(ctx, SerovalBinaryType.Temporal);
  const type = (await deserializeByte(ctx)) as SerovalTemporalType;
  const isoRef = await deserializeRef(
    ctx,
    SerovalBinaryType.Temporal,
    SerovalBinaryType.String,
  );

  upsert(ctx, id, deserializeTemporalInner(ctx, type, isoRef));
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
    case SerovalBinaryType.Temporal:
      await deserializeTemporal(ctx);
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
