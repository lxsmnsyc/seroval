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
  STREAM_CONSTRUCTOR,
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
import { getReference } from '../core/reference';
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
import { decodeBigint, decodeString } from './encoder';
import { SerovalBinaryType, SerovalEndianness } from './nodes';

const MAX_REGEXP_SOURCE_LENGTH = 20_000;

// Same cap as the ArrayBuffer deserialization limit (MAX_BASE64_LENGTH).
const MAX_TYPED_ARRAY_LENGTH = 1_000_000;

// The join state of a container: how many child assignments are still
// outstanding, and a resolver that fires once the count reaches zero.
interface PendingState {
  count: number;
  // Set once the container's `Pending` node is read. Assignments after it,
  // or a second `Pending`, are malformed.
  declared: boolean;
  // Assignments waiting on a Plugin value. They release the count later, so
  // a payload may end while they are still running.
  inflight: number;
  // Set once every assignment has been applied.
  settled: boolean;
  // Created only when something waits for the container to settle.
  resolver: PromiseConstructorResolver | undefined;
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
  // How many containers in `pendingResolvers` have not settled yet. While it
  // is zero, every subtree is complete and nothing has to be awaited.
  unsettled: number;
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
    unsettled: 0,
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
  // The bytes being parsed, a view over them, and the read position.
  buffer: Uint8Array;
  view: DataView;
  offset: number;
  littleEndian: boolean;
  // Chunks read but not yet joined into `buffer`, and their total size.
  // Joining once per read target keeps many small chunks from being copied
  // over and over.
  chunks: Uint8Array[];
  chunkSize: number;
  features: number;
  // Values created by this payload that must settle before it ends.
  containers: number[];
  openPromises: Set<number>;
  openStreams: Set<number>;
  aborted: boolean;
}

const EMPTY_BYTES = new Uint8Array(0);

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
    buffer: EMPTY_BYTES,
    view: new DataView(EMPTY_BYTES.buffer),
    offset: 0,
    littleEndian: true,
    chunks: [],
    chunkSize: 0,
    containers: [],
    openPromises: new Set(),
    openStreams: new Set(),
    aborted: false,
    root: {
      resolver: PROMISE_CONSTRUCTOR(),
      found: false,
      id: undefined,
    },
  };
}

async function readChunk(ctx: DeserializerContext) {
  const chunk = await ctx.read();
  if (chunk) {
    if (chunk.length) {
      ctx.chunks.push(chunk);
      ctx.chunkSize += chunk.length;
    }
  } else {
    ctx.done = true;
  }
}

function bufferedBytes(ctx: DeserializerContext): number {
  return ctx.buffer.length - ctx.offset;
}

function availableBytes(ctx: DeserializerContext): number {
  return bufferedBytes(ctx) + ctx.chunkSize;
}

function setBuffer(ctx: DeserializerContext, buffer: Uint8Array): void {
  ctx.buffer = buffer;
  ctx.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  ctx.offset = 0;
}

// Joins the unread bytes and the chunks read so far into one buffer. A
// single chunk with nothing left over is used as is.
function joinChunks(ctx: DeserializerContext): void {
  const chunks = ctx.chunks;
  const rest = bufferedBytes(ctx);
  if (rest === 0 && chunks.length === 1) {
    setBuffer(ctx, chunks[0]);
  } else {
    const result = new Uint8Array(rest + ctx.chunkSize);
    result.set(ctx.buffer.subarray(ctx.offset));
    let offset = rest;
    for (let i = 0, len = chunks.length; i < len; i++) {
      result.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    setBuffer(ctx, result);
  }
  ctx.chunks = [];
  ctx.chunkSize = 0;
}

// Makes the next `length` bytes contiguous. Returns false if they have not
// been read yet.
function ensureBuffered(ctx: DeserializerContext, length: number): boolean {
  if (bufferedBytes(ctx) >= length) {
    return true;
  }
  if (availableBytes(ctx) >= length) {
    joinChunks(ctx);
    return true;
  }
  return false;
}

// The functions below read from the buffer. `drain` checks that the whole
// node is buffered before it is parsed, so they never run past the end.

function readBytes(ctx: DeserializerContext, length: number): Uint8Array {
  const start = ctx.offset;
  ctx.offset += length;
  return ctx.buffer.subarray(start, ctx.offset);
}

function isThenable(value: unknown): boolean {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
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

function deserializeByte(ctx: DeserializerContext): number {
  return ctx.buffer[ctx.offset++];
}

function deserializeUint(ctx: DeserializerContext): number {
  const value = ctx.view.getUint32(ctx.offset, ctx.littleEndian);
  ctx.offset += 4;
  return value;
}

function deserializeInt(ctx: DeserializerContext): number {
  const value = ctx.view.getInt32(ctx.offset, ctx.littleEndian);
  ctx.offset += 4;
  return value;
}

function deserializeNumberValue(ctx: DeserializerContext): number {
  const value = ctx.view.getFloat64(ctx.offset, ctx.littleEndian);
  ctx.offset += 8;
  return value;
}

function deserializePreamble(ctx: DeserializerContext) {
  ctx.littleEndian =
    (deserializeByte(ctx) as SerovalEndianness) === SerovalEndianness.LE;
}

function upsert(ctx: DeserializerContext, id: number, value: unknown) {
  ctx.refs.values.set(id, value);
}

function deserializeId(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
): number {
  // parse ID
  const id = deserializeUint(ctx);
  // An id is declared once. Redeclaring it would swap the value behind refs
  // that were already validated against the first declaration.
  if (ctx.refs.types.has(id)) {
    throw new SerovalMalformedBinaryTypeError(type);
  }
  // Mark id
  ctx.refs.types.set(id, type);
  return id;
}

function deserializeRef(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  expected: SerovalBinaryType,
) {
  const ref = deserializeUint(ctx);
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
function deserializeRefOf(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  expected: SerovalBinaryType[],
) {
  const ref = deserializeUint(ctx);
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
  if (ctx.refs.unsettled === 0) {
    return;
  }
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
      const wait = blocked ? undefined : waitPending(entry);
      if (wait) {
        await wait;
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
  const value = ctx.refs.values.get(ref);
  // `undefined` is also a valid value, so only then check that it is stored.
  if (value !== undefined || ctx.refs.values.has(ref)) {
    return value;
  }
  throw new SerovalMissingBinaryRefError(ref);
}

// Used only where a slot may hold a Plugin, whose identity resolves later.
// The value is boxed so a promise or thenable value is passed on as is and
// never adopted by `await`.
async function getRefAsync(
  ctx: DeserializerContext,
  ref: number,
): Promise<{ value: unknown }> {
  const pending = ctx.refs.deferred.get(ref);
  if (pending) {
    return { value: await pending };
  }
  return { value: getRefSync(ctx, ref) };
}

function invalidatePending(ctx: DeserializerContext, entry: PendingState) {
  if (entry.count === 0 && !entry.settled) {
    entry.settled = true;
    ctx.refs.unsettled--;
    entry.resolver?.s(true);
  }
}

// Returns a promise for a container that has not settled yet.
function waitPending(entry: PendingState): Promise<unknown> | undefined {
  if (entry.settled) {
    return undefined;
  }
  entry.resolver ??= PROMISE_CONSTRUCTOR();
  return entry.resolver.p;
}

function popPendingState(ctx: DeserializerContext, id: number) {
  const entry = ctx.refs.pendingResolvers.get(id);
  if (entry) {
    entry.count -= 1;
    invalidatePending(ctx, entry);
  }
}

function trackInflight(ctx: DeserializerContext, id: number, delta: number) {
  const entry = ctx.refs.pendingResolvers.get(id);
  if (entry) {
    entry.inflight += delta;
  }
}

function createPending(ctx: DeserializerContext, id: number) {
  ctx.refs.pendingResolvers.set(id, {
    count: 0,
    declared: false,
    inflight: 0,
    settled: false,
    resolver: undefined,
  });
  ctx.refs.unsettled++;
  ctx.containers.push(id);
}

// Rejects an assignment to a container whose `Pending` node was already read.
function assertOpenContainer(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  id: number,
): void {
  const entry = ctx.refs.pendingResolvers.get(id);
  if (!entry || entry.declared) {
    throw new SerovalMalformedBinaryTypeError(type);
  }
}

function isSequenceIndex(value: number, size: number): boolean {
  return value >= -1 && value < size;
}

function deserializePending(ctx: DeserializerContext) {
  const id = deserializeRefOf(
    ctx,
    SerovalBinaryType.Pending,
    PENDING_TARGETS,
  );
  const amount = deserializeUint(ctx);

  const entry = ctx.refs.pendingResolvers.get(id);
  if (!entry || entry.declared) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.Pending);
  }
  // The serializer sends every assignment of a container before its
  // `Pending` node, so the amount must match what was received.
  const received = ctx.refs.children.get(id)?.length ?? 0;
  if (ctx.refs.types.get(id) === SerovalBinaryType.Sequence) {
    // A sequence iterator stops only once its index passes the done index, so
    // both indices must point inside the values that were actually sent.
    const sequence = getRefSync(ctx, id) as Sequence;
    if (
      amount !== received ||
      !isSequenceIndex(sequence.t, amount) ||
      !isSequenceIndex(sequence.d, amount)
    ) {
      throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.Sequence);
    }
  }
  entry.declared = true;
  entry.count += amount;
  invalidatePending(ctx, entry);
}

function deserializeConstant(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Constant);
  const byte = deserializeByte(ctx) as SerovalConstant;
  upsert(
    ctx,
    id,
    deserializeKnownValue(SerovalBinaryType.Constant, CONSTANT_VAL, byte),
  );
}

function deserializeNumber(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Number);
  const value = deserializeNumberValue(ctx);
  upsert(ctx, id, value);
}

function deserializeString(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.String);
  // First, ensure that there's an encoded length
  const length = deserializeUint(ctx);
  // Ensure the next chunk is based on encoded length
  const encodedData = readBytes(ctx, length);
  upsert(ctx, id, decodeString(encodedData));
}

function deserializeBigint(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.BigInt);
  const sign = deserializeByte(ctx);
  const stringRef = deserializeRef(
    ctx,
    SerovalBinaryType.BigInt,
    SerovalBinaryType.String,
  );
  const value = decodeBigint(getRefSync(ctx, stringRef) as string);
  upsert(ctx, id, sign ? -value : value);
}

function deserializeWKSymbol(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.WKSymbol);
  const byte = deserializeByte(ctx) as Symbols;
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
    trackInflight(ctx, container, 1);
    pending.then(
      value => {
        try {
          apply(value);
        } catch (err) {
          ctx.onError(err);
        } finally {
          trackInflight(ctx, container, -1);
          popPendingState(ctx, container);
        }
      },
      err => {
        ctx.onError(err);
        trackInflight(ctx, container, -1);
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

function deserializeObjectAssign(ctx: DeserializerContext) {
  const object = deserializeRefOf(
    ctx,
    SerovalBinaryType.ObjectAssign,
    PROPERTY_TARGETS,
  );
  // The serializer only ever emits a String or a well-known symbol as a key.
  // Validating it here keeps untrusted input from aiming a key slot at some
  // other node type, so the `as string` cast below can never be a lie.
  const key = deserializeRefOf(ctx, SerovalBinaryType.ObjectAssign, [
    SerovalBinaryType.String,
    SerovalBinaryType.WKSymbol,
  ]);
  const value = deserializeUint(ctx);

  assertOpenContainer(ctx, SerovalBinaryType.ObjectAssign, object);
  trackChild(ctx, object, value);
  runAssignment(ctx, object, value, resolved => {
    assignProperty(
      getRefSync(ctx, object) as Record<string, unknown>,
      getRefSync(ctx, key) as string,
      resolved,
    );
  });
}

function deserializeArrayAssign(ctx: DeserializerContext) {
  const object = deserializeRef(
    ctx,
    SerovalBinaryType.ArrayAssign,
    SerovalBinaryType.Array,
  );
  const index = deserializeUint(ctx);
  const value = deserializeUint(ctx);

  assertOpenContainer(ctx, SerovalBinaryType.ArrayAssign, object);
  trackChild(ctx, object, value);
  runAssignment(ctx, object, value, resolved => {
    (getRefSync(ctx, object) as unknown[])[index] = resolved;
  });
}

function applyObjectFlag(
  ctx: DeserializerContext,
  id: number,
  flag: SerovalObjectFlags,
): void {
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
}

async function deserializeObjectFlagInner(
  ctx: DeserializerContext,
  id: number,
  flag: SerovalObjectFlags,
  entry: PendingState,
) {
  // A flag can only be applied once every property is in place.
  await waitPending(entry);
  applyObjectFlag(ctx, id, flag);
}

function deserializeObjectFlag(ctx: DeserializerContext) {
  const object = deserializeRefOf(
    ctx,
    SerovalBinaryType.ObjectFlag,
    FLAG_TARGETS,
  );
  const flag = deserializeByte(ctx) as SerovalObjectFlags;

  const entry = ctx.refs.pendingResolvers.get(object);
  if (!entry) {
    ctx.onError(new SerovalMalformedBinarySourceError());
    return;
  }
  // Most objects are extensible, so there is nothing to apply.
  if (flag !== SerovalObjectFlags.None) {
    deserializeObjectFlagInner(ctx, object, flag, entry).catch(ctx.onError);
  }
}

function deserializeArray(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Array);
  const length = deserializeUint(ctx);
  createPending(ctx, id);
  upsert(ctx, id, new Array(length));
}

function deserializeStream(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Stream);
  const live = deserializeByte(ctx);
  // A live stream keeps its history only until the first listener, then
  // forwards values without storing them, like the JSON live receiver.
  upsert(
    ctx,
    id,
    live === 1
      ? (STREAM_CONSTRUCTOR(1) as unknown as Stream<unknown>)
      : createStream(),
  );
  ctx.openStreams.add(id);
}

// A stream accepts no events after it ends.
function assertOpenStream(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  stream: number,
): void {
  if (!ctx.openStreams.has(stream)) {
    throw new SerovalMalformedBinaryTypeError(type);
  }
}

async function deserializeStreamNextInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const s = getRefSync(ctx, stream) as Stream<unknown>;
  s.next((await getRefAsync(ctx, value)).value);
}

function deserializeStreamNext(ctx: DeserializerContext) {
  const stream = deserializeRef(
    ctx,
    SerovalBinaryType.StreamNext,
    SerovalBinaryType.Stream,
  );
  const value = deserializeUint(ctx);
  assertOpenStream(ctx, SerovalBinaryType.StreamNext, stream);
  deserializeStreamNextInner(ctx, stream, value).catch(ctx.onError);
}

async function deserializeStreamThrowInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const s = getRefSync(ctx, stream) as Stream<unknown>;
  s.throw((await getRefAsync(ctx, value)).value);
}

function deserializeStreamThrow(ctx: DeserializerContext) {
  const stream = deserializeRef(
    ctx,
    SerovalBinaryType.StreamThrow,
    SerovalBinaryType.Stream,
  );
  const value = deserializeUint(ctx);
  assertOpenStream(ctx, SerovalBinaryType.StreamThrow, stream);
  ctx.openStreams.delete(stream);
  deserializeStreamThrowInner(ctx, stream, value).catch(ctx.onError);
}

async function deserializeStreamReturnInner(
  ctx: DeserializerContext,
  stream: number,
  value: number,
) {
  const s = getRefSync(ctx, stream) as Stream<unknown>;
  s.return((await getRefAsync(ctx, value)).value);
}

function deserializeStreamReturn(ctx: DeserializerContext) {
  const stream = deserializeRef(
    ctx,
    SerovalBinaryType.StreamReturn,
    SerovalBinaryType.Stream,
  );
  const value = deserializeUint(ctx);
  assertOpenStream(ctx, SerovalBinaryType.StreamReturn, stream);
  ctx.openStreams.delete(stream);
  deserializeStreamReturnInner(ctx, stream, value).catch(ctx.onError);
}

function deserializeSequence(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Sequence);
  const throwAt = deserializeInt(ctx);
  const doneAt = deserializeInt(ctx);
  createPending(ctx, id);
  upsert(ctx, id, createSequence([], throwAt, doneAt));
}
function deserializeSequencePush(ctx: DeserializerContext) {
  const sequence = deserializeRef(
    ctx,
    SerovalBinaryType.SequencePush,
    SerovalBinaryType.Sequence,
  );
  const value = deserializeUint(ctx);
  assertOpenContainer(ctx, SerovalBinaryType.SequencePush, sequence);
  trackChild(ctx, sequence, value);
  runAssignment(ctx, sequence, value, resolved => {
    (getRefSync(ctx, sequence) as Sequence).v.push(resolved);
  });
}

function deserializeObject(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Object);
  createPending(ctx, id);
  upsert(ctx, id, {});
}

function deserializeNullConstructor(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.NullConstructor);
  createPending(ctx, id);
  upsert(ctx, id, Object.create(null));
}

function deserializeDate(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Date);
  const timestamp = deserializeNumberValue(ctx);
  upsert(ctx, id, new Date(timestamp));
}

function deserializeError(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Error);
  const tag = deserializeByte(ctx) as ErrorConstructorTag;
  const message = deserializeRef(
    ctx,
    SerovalBinaryType.Error,
    SerovalBinaryType.String,
  );
  const construct = deserializeKnownValue(
    SerovalBinaryType.Error,
    ERROR_CONSTRUCTOR,
    tag,
  );
  createPending(ctx, id);
  upsert(ctx, id, new construct(getRefSync(ctx, message) as string));
}

function deserializeBoxed(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Boxed);
  const value = deserializeUint(ctx);
  trackChild(ctx, id, value);
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: intentional
  upsert(ctx, id, Object(getRefSync(ctx, value)));
}

function deserializeArrayBuffer(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.ArrayBuffer);
  const length = deserializeUint(ctx);
  const bytes = readBytes(ctx, length);
  upsert(
    ctx,
    id,
    // We can't really use the buffer directly.
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

// The view constructors throw a `RangeError` for an offset or length outside
// the buffer, or a misaligned offset. Report that as malformed input.
function createView<T>(type: SerovalBinaryType, create: () => T): T {
  try {
    return create();
  } catch {
    throw new SerovalMalformedBinaryTypeError(type);
  }
}

function deserializeTypedArray(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.TypedArray);
  const tag = deserializeByte(ctx) as TypedArrayTag;
  const buffer = deserializeRef(
    ctx,
    SerovalBinaryType.TypedArray,
    SerovalBinaryType.ArrayBuffer,
  );
  const offset = deserializeUint(ctx);
  const length = deserializeUint(ctx);
  if (length > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.TypedArray);
  }
  const construct = deserializeKnownValue(
    SerovalBinaryType.TypedArray,
    TYPED_ARRAY_CONSTRUCTOR,
    tag,
  );
  upsert(
    ctx,
    id,
    createView(SerovalBinaryType.TypedArray, () => {
      return new construct(
        getRefSync(ctx, buffer) as ArrayBuffer,
        offset,
        length,
      );
    }),
  );
}

function deserializeBigIntTypedArray(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.BigIntTypedArray);
  const tag = deserializeByte(ctx) as BigIntTypedArrayTag;
  const buffer = deserializeRef(
    ctx,
    SerovalBinaryType.BigIntTypedArray,
    SerovalBinaryType.ArrayBuffer,
  );
  const offset = deserializeUint(ctx);
  const length = deserializeUint(ctx);
  if (length > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalMalformedBinaryTypeError(
      SerovalBinaryType.BigIntTypedArray,
    );
  }
  const construct = deserializeKnownValue(
    SerovalBinaryType.BigIntTypedArray,
    BIG_INT_TYPED_ARRAY_CONSTRUCTOR,
    tag,
  );
  upsert(
    ctx,
    id,
    createView(SerovalBinaryType.BigIntTypedArray, () => {
      return new construct(
        getRefSync(ctx, buffer) as ArrayBuffer,
        offset,
        length,
      );
    }),
  );
}

function deserializeDataView(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.DataView);
  const buffer = deserializeRef(
    ctx,
    SerovalBinaryType.DataView,
    SerovalBinaryType.ArrayBuffer,
  );
  const offset = deserializeUint(ctx);
  const length = deserializeUint(ctx);
  if (length > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.DataView);
  }
  upsert(
    ctx,
    id,
    createView(SerovalBinaryType.DataView, () => {
      return new DataView(
        getRefSync(ctx, buffer) as ArrayBuffer,
        offset,
        length,
      );
    }),
  );
}

function deserializeMap(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Map);
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
    trackInflight(ctx, id, 1);
    Promise.all([getRefAsync(ctx, key), getRefAsync(ctx, value)]).then(
      ([k, v]) => {
        try {
          set(k.value, v.value);
        } catch (err) {
          ctx.onError(err);
        } finally {
          trackInflight(ctx, id, -1);
          popPendingState(ctx, id);
        }
      },
      err => {
        ctx.onError(err);
        trackInflight(ctx, id, -1);
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

function deserializeMapSet(ctx: DeserializerContext) {
  const object = deserializeRef(
    ctx,
    SerovalBinaryType.MapSet,
    SerovalBinaryType.Map,
  );
  const key = deserializeUint(ctx);
  const value = deserializeUint(ctx);

  assertOpenContainer(ctx, SerovalBinaryType.MapSet, object);
  trackChild(ctx, object, key);
  trackChild(ctx, object, value);
  deserializeMapSetEntry(ctx, object, key, value);
}

function deserializeSet(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Set);
  createPending(ctx, id);
  upsert(ctx, id, new Set());
}

function deserializeSetAdd(ctx: DeserializerContext) {
  const object = deserializeRef(
    ctx,
    SerovalBinaryType.SetAdd,
    SerovalBinaryType.Set,
  );
  const value = deserializeUint(ctx);

  assertOpenContainer(ctx, SerovalBinaryType.SetAdd, object);
  trackChild(ctx, object, value);
  runAssignment(ctx, object, value, resolved => {
    (getRefSync(ctx, object) as Set<unknown>).add(resolved);
  });
}

function deserializePromise(ctx: DeserializerContext) {
  const promise = deserializeId(ctx, SerovalBinaryType.Promise);

  const instance = PROMISE_CONSTRUCTOR();
  ctx.refs.promiseResolvers.set(promise, instance);
  ctx.openPromises.add(promise);
  // A Promise node's identity - the user-facing promise object - is known
  // immediately, so it is stored raw like any other value, not deferred.
  upsert(ctx, promise, instance.p);
}

// A promise accepts one settle node.
function settlePromiseNode(
  ctx: DeserializerContext,
  type: SerovalBinaryType,
  promise: number,
): void {
  if (!ctx.openPromises.has(promise)) {
    throw new SerovalMalformedBinaryTypeError(type);
  }
  ctx.openPromises.delete(promise);
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
  // A promise never settles with another promise; the serializer only sends
  // the settled value. Rejecting it here also stops a promise that settles
  // with itself.
  if (ctx.refs.types.get(value) === SerovalBinaryType.Promise) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.PromiseSuccess);
  }
  // Read the value without adopting it, then reject thenables before any
  // `then` method can run.
  const resolvingValue = (await getRefAsync(ctx, value)).value;
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

function deserializePromiseSuccess(ctx: DeserializerContext) {
  // Only Promise ids ever reach `promiseResolvers`, but validating the target
  // type up front turns a wrong reference into a clear error.
  const resolver = deserializeRef(
    ctx,
    SerovalBinaryType.PromiseSuccess,
    SerovalBinaryType.Promise,
  );
  const value = deserializeUint(ctx);
  settlePromiseNode(ctx, SerovalBinaryType.PromiseSuccess, resolver);

  deserializePromiseFulfillInner(ctx, true, resolver, value).catch(error => {
    rejectPromiseNode(ctx, resolver, error);
  });
}

function deserializePromiseFailure(ctx: DeserializerContext) {
  const resolver = deserializeRef(
    ctx,
    SerovalBinaryType.PromiseFailure,
    SerovalBinaryType.Promise,
  );
  const value = deserializeUint(ctx);
  settlePromiseNode(ctx, SerovalBinaryType.PromiseFailure, resolver);

  deserializePromiseFulfillInner(ctx, false, resolver, value).catch(error => {
    rejectPromiseNode(ctx, resolver, error);
  });
}

// A settle node that cannot be applied still ends its promise, with the
// error, so the promise does not wait for a node that will never come.
function rejectPromiseNode(
  ctx: DeserializerContext,
  promise: number,
  error: unknown,
): void {
  ctx.onError(error);
  ctx.refs.promiseResolvers.get(promise)?.f(error);
}

function deserializeRegExp(ctx: DeserializerContext) {
  if (!(ctx.features & Feature.RegExp)) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.RegExp);
  }
  const id = deserializeId(ctx, SerovalBinaryType.RegExp);
  const pattern = deserializeRef(
    ctx,
    SerovalBinaryType.RegExp,
    SerovalBinaryType.String,
  );
  const flags = deserializeRef(
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

function deserializeAggregateError(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.AggregateError);
  const message = deserializeRef(
    ctx,
    SerovalBinaryType.AggregateError,
    SerovalBinaryType.String,
  );
  createPending(ctx, id);
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

function deserializePlugin(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Plugin);
  const tag = deserializeRef(
    ctx,
    SerovalBinaryType.Plugin,
    SerovalBinaryType.String,
  );
  const options = deserializeUint(ctx);

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
    await waitPending(entry);
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

function deserializeRoot(ctx: DeserializerContext) {
  const ref = deserializeUint(ctx);
  deserializeRootInner(ctx, ref).catch(ctx.onError);
}

function deserializeIterator(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Iterator);
  const sequence = deserializeRef(
    ctx,
    SerovalBinaryType.Iterator,
    SerovalBinaryType.Sequence,
  );
  // The sequence's indices are checked when its `Pending` node is read, so
  // the iterator may only use a sequence that already has one.
  if (!ctx.refs.pendingResolvers.get(sequence)?.declared) {
    throw new SerovalMalformedBinaryTypeError(SerovalBinaryType.Iterator);
  }
  trackChild(ctx, id, sequence);
  upsert(ctx, id, sequenceToIterator(getRefSync(ctx, sequence) as Sequence));
}

function deserializeAsyncIterator(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.AsyncIterator);
  const stream = deserializeRef(
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
  // A runtime without the Temporal API cannot build the value.
  if (!(ctx.features & Feature.Temporal) || typeof Temporal === 'undefined') {
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

function deserializeTemporal(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Temporal);
  const type = deserializeByte(ctx) as SerovalTemporalType;
  const isoRef = deserializeRef(
    ctx,
    SerovalBinaryType.Temporal,
    SerovalBinaryType.String,
  );

  upsert(ctx, id, deserializeTemporalInner(ctx, type, isoRef));
}

function deserializeReference(ctx: DeserializerContext) {
  const id = deserializeId(ctx, SerovalBinaryType.Reference);
  const key = deserializeRef(
    ctx,
    SerovalBinaryType.Reference,
    SerovalBinaryType.String,
  );
  // Throws if no value was registered under the key on this side.
  upsert(ctx, id, getReference(getRefSync(ctx, key) as string));
}

function deserializeChunk(ctx: DeserializerContext) {
  // Read first byte
  const firstByte = deserializeByte(ctx) as SerovalBinaryType;

  switch (firstByte) {
    case SerovalBinaryType.Preamble:
      deserializePreamble(ctx);
      break;
    case SerovalBinaryType.Constant:
      deserializeConstant(ctx);
      break;
    case SerovalBinaryType.Number:
      deserializeNumber(ctx);
      break;
    case SerovalBinaryType.String:
      deserializeString(ctx);
      break;
    case SerovalBinaryType.BigInt:
      deserializeBigint(ctx);
      break;
    case SerovalBinaryType.WKSymbol:
      deserializeWKSymbol(ctx);
      break;
    case SerovalBinaryType.ObjectAssign:
      deserializeObjectAssign(ctx);
      break;
    case SerovalBinaryType.ArrayAssign:
      deserializeArrayAssign(ctx);
      break;
    case SerovalBinaryType.ObjectFlag:
      deserializeObjectFlag(ctx);
      break;
    case SerovalBinaryType.Array:
      deserializeArray(ctx);
      break;
    case SerovalBinaryType.Stream:
      deserializeStream(ctx);
      break;
    case SerovalBinaryType.StreamNext:
      deserializeStreamNext(ctx);
      break;
    case SerovalBinaryType.StreamThrow:
      deserializeStreamThrow(ctx);
      break;
    case SerovalBinaryType.StreamReturn:
      deserializeStreamReturn(ctx);
      break;
    case SerovalBinaryType.Sequence:
      deserializeSequence(ctx);
      break;
    case SerovalBinaryType.SequencePush:
      deserializeSequencePush(ctx);
      break;
    case SerovalBinaryType.Object:
      deserializeObject(ctx);
      break;
    case SerovalBinaryType.NullConstructor:
      deserializeNullConstructor(ctx);
      break;
    case SerovalBinaryType.Date:
      deserializeDate(ctx);
      break;
    case SerovalBinaryType.Error:
      deserializeError(ctx);
      break;
    case SerovalBinaryType.Boxed:
      deserializeBoxed(ctx);
      break;
    case SerovalBinaryType.ArrayBuffer:
      deserializeArrayBuffer(ctx);
      break;
    case SerovalBinaryType.TypedArray:
      deserializeTypedArray(ctx);
      break;
    case SerovalBinaryType.BigIntTypedArray:
      deserializeBigIntTypedArray(ctx);
      break;
    case SerovalBinaryType.DataView:
      deserializeDataView(ctx);
      break;
    case SerovalBinaryType.Map:
      deserializeMap(ctx);
      break;
    case SerovalBinaryType.MapSet:
      deserializeMapSet(ctx);
      break;
    case SerovalBinaryType.Set:
      deserializeSet(ctx);
      break;
    case SerovalBinaryType.SetAdd:
      deserializeSetAdd(ctx);
      break;
    case SerovalBinaryType.Promise:
      deserializePromise(ctx);
      break;
    case SerovalBinaryType.PromiseSuccess:
      deserializePromiseSuccess(ctx);
      break;
    case SerovalBinaryType.PromiseFailure:
      deserializePromiseFailure(ctx);
      break;
    case SerovalBinaryType.RegExp:
      deserializeRegExp(ctx);
      break;
    case SerovalBinaryType.AggregateError:
      deserializeAggregateError(ctx);
      break;
    case SerovalBinaryType.Plugin:
      deserializePlugin(ctx);
      break;
    case SerovalBinaryType.Root:
      deserializeRoot(ctx);
      break;
    case SerovalBinaryType.Iterator:
      deserializeIterator(ctx);
      break;
    case SerovalBinaryType.AsyncIterator:
      deserializeAsyncIterator(ctx);
      break;
    case SerovalBinaryType.Pending:
      deserializePending(ctx);
      break;
    case SerovalBinaryType.Temporal:
      deserializeTemporal(ctx);
      break;
    case SerovalBinaryType.Reference:
      deserializeReference(ctx);
      break;
    default:
      throw new SerovalUnknownBinaryTypeError(firstByte);
  }
}

// Checks that everything this payload started was finished before it ended.
function assertComplete(ctx: DeserializerContext): void {
  if (!ctx.root.found) {
    throw new SerovalMalformedBinarySourceError();
  }
  for (let i = 0, len = ctx.containers.length; i < len; i++) {
    const entry = ctx.refs.pendingResolvers.get(ctx.containers[i]);
    // Every assignment still owed must be one that is already running.
    if (entry && !(entry.declared && entry.count === entry.inflight)) {
      throw new SerovalMalformedBinarySourceError();
    }
  }
  if (ctx.openPromises.size || ctx.openStreams.size) {
    throw new SerovalMalformedBinarySourceError();
  }
}

// Size of each node in bytes, including its type byte. A String or an
// ArrayBuffer also carries as many bytes as its length says.
const NODE_SIZE: Record<SerovalBinaryType, number> = {
  [SerovalBinaryType.Preamble]: 2,
  [SerovalBinaryType.Root]: 5,
  [SerovalBinaryType.Constant]: 6,
  [SerovalBinaryType.Number]: 13,
  [SerovalBinaryType.String]: 9,
  [SerovalBinaryType.BigInt]: 10,
  [SerovalBinaryType.WKSymbol]: 6,
  [SerovalBinaryType.ObjectAssign]: 13,
  [SerovalBinaryType.ArrayAssign]: 13,
  [SerovalBinaryType.ObjectFlag]: 6,
  [SerovalBinaryType.Array]: 9,
  [SerovalBinaryType.Stream]: 6,
  [SerovalBinaryType.StreamNext]: 9,
  [SerovalBinaryType.StreamThrow]: 9,
  [SerovalBinaryType.StreamReturn]: 9,
  [SerovalBinaryType.Sequence]: 13,
  [SerovalBinaryType.SequencePush]: 9,
  [SerovalBinaryType.Plugin]: 13,
  [SerovalBinaryType.Object]: 5,
  [SerovalBinaryType.NullConstructor]: 5,
  [SerovalBinaryType.Date]: 13,
  [SerovalBinaryType.Error]: 10,
  [SerovalBinaryType.Boxed]: 9,
  [SerovalBinaryType.ArrayBuffer]: 9,
  [SerovalBinaryType.TypedArray]: 18,
  [SerovalBinaryType.BigIntTypedArray]: 18,
  [SerovalBinaryType.DataView]: 17,
  [SerovalBinaryType.Map]: 5,
  [SerovalBinaryType.MapSet]: 13,
  [SerovalBinaryType.Set]: 5,
  [SerovalBinaryType.SetAdd]: 9,
  [SerovalBinaryType.Promise]: 5,
  [SerovalBinaryType.PromiseSuccess]: 9,
  [SerovalBinaryType.PromiseFailure]: 9,
  [SerovalBinaryType.RegExp]: 13,
  [SerovalBinaryType.AggregateError]: 9,
  [SerovalBinaryType.Iterator]: 9,
  [SerovalBinaryType.AsyncIterator]: 9,
  [SerovalBinaryType.Pending]: 9,
  [SerovalBinaryType.Temporal]: 10,
  [SerovalBinaryType.Reference]: 9,
};

/**
 * Returns how many bytes the next node needs, or how many are needed to find
 * that out: a String or an ArrayBuffer stores its length after its id.
 */
function getNodeSize(ctx: DeserializerContext): number {
  const type = ctx.buffer[ctx.offset] as SerovalBinaryType;
  if (!Object.hasOwn(NODE_SIZE, type)) {
    throw new SerovalUnknownBinaryTypeError(type);
  }
  const size = NODE_SIZE[type];
  if (
    (type === SerovalBinaryType.String ||
      type === SerovalBinaryType.ArrayBuffer) &&
    ensureBuffered(ctx, size)
  ) {
    return size + ctx.view.getUint32(ctx.offset + 5, ctx.littleEndian);
  }
  return size;
}

// Parses every node that is fully buffered, and reads more chunks when the
// next node is not. Nodes are parsed synchronously, so a buffered payload is
// decoded without waiting between nodes.
async function drain(ctx: DeserializerContext) {
  while (true) {
    if (ensureBuffered(ctx, 1)) {
      const size = getNodeSize(ctx);
      if (ensureBuffered(ctx, size)) {
        deserializeChunk(ctx);
      } else if (ctx.done) {
        throw new SerovalMalformedBinarySourceError();
      } else {
        await readChunk(ctx);
      }
    } else if (ctx.done) {
      assertComplete(ctx);
      return;
    } else {
      await readChunk(ctx);
    }
  }
}

/**
 * Ends a payload that failed. The root promise is rejected if it has not
 * resolved yet, unsettled promises are rejected, and open streams are thrown
 * into, all with `reason`. Without this they would wait forever for nodes
 * that will never arrive.
 */
function abortDeserialize(ctx: DeserializerContext, reason: unknown): void {
  if (ctx.aborted) {
    return;
  }
  ctx.aborted = true;
  ctx.root.resolver.f(reason);
  // The failure is already reported through `onError`, and some of these
  // promises may not be reachable from the root at all. Mark the rejections
  // as handled so they are not reported again as unhandled. Code awaiting the
  // promises still sees the rejection.
  for (const id of ctx.openPromises) {
    const resolver = ctx.refs.promiseResolvers.get(id);
    if (resolver) {
      resolver.p.catch(() => {
        // no-op
      });
      resolver.f(reason);
    }
  }
  ctx.openPromises.clear();
  for (const id of ctx.openStreams) {
    try {
      (ctx.refs.values.get(id) as Stream<unknown>).throw(reason);
    } catch {
      // A listener error must not stop the other streams from ending.
    }
  }
  ctx.openStreams.clear();
}

export function deserializeStart(ctx: DeserializerContext) {
  drain(ctx).catch(error => {
    ctx.onError(error);
    abortDeserialize(ctx, error);
  });
  return ctx.root.resolver.p;
}
