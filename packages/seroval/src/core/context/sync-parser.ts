import {
  createArrayNode,
  createBigIntNode,
  createBoxedNode,
  createDataViewNode,
  createDateNode,
  createErrorNode,
  createIteratorFactoryInstanceNode,
  createNumberNode,
  createPluginNode,
  createRegExpNode,
  createSequenceNode,
  createSetNode,
  createStreamConstructorNode,
  createStringNode,
  createTemporalNode,
  createTypedArrayNode,
} from '../base-primitives';
import { FeatureFlag } from '../compat';
import { NIL, SerovalNodeType, SerovalTemporalType } from '../constants';
import {
  SerovalDepthLimitError,
  SerovalParserError,
  SerovalUnsupportedTypeError,
} from '../errors';
import { FALSE_NODE, NULL_NODE, TRUE_NODE, UNDEFINED_NODE } from '../literals';
import { isLiveStream, type LiveStream } from '../live-stream';
import { OpaqueReference } from '../opaque-reference';
import type { Plugin, SerovalMode } from '../plugin';
import {
  createSequenceFromIterable,
  isSequence,
  type Sequence,
} from '../sequence';
import { SpecialReference } from '../special-reference';
import type { Stream } from '../stream';
import { isStream } from '../stream';
import { serializeString } from '../string';
import {
  SYM_ASYNC_ITERATOR,
  SYM_IS_CONCAT_SPREADABLE,
  SYM_ITERATOR,
  SYM_TO_STRING_TAG,
} from '../symbols';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalDataViewNode,
  SerovalErrorNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeWithID,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalSequenceNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from '../types';
import { getErrorOptions } from '../utils/error';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../utils/typed-array';
import type { BaseParserContext, BaseParserContextOptions } from './parser';
import {
  createArrayBufferNode,
  createBaseParserContext,
  createIndexForValue,
  createMapNode,
  createObjectNode,
  createPromiseConstructorNode,
  getArrayBufferView,
  getObjectClass,
  getObjectKind,
  getReferenceNode,
  getTemporalType,
  ObjectKind,
  parseAsyncIteratorFactory,
  parseIteratorFactory,
  parseSpecialReference,
  parseWellKnownSymbol,
} from './parser';

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode;

export type SyncParserContextOptions = BaseParserContextOptions;

export const enum ParserMode {
  Sync = 1,
  Stream = 2,
}

export interface SyncParserContext {
  type: ParserMode.Sync;
  base: BaseParserContext;
  child: SyncParsePluginContext | undefined;
}

export function createSyncParserContext(
  mode: SerovalMode,
  options: SyncParserContextOptions,
): SyncParserContext {
  return {
    type: ParserMode.Sync,
    base: createBaseParserContext(mode, options),
    child: NIL,
  };
}

export class SyncParsePluginContext {
  constructor(
    private _p: SOSParserContext,
    private depth: number,
  ) {}

  parse<T>(current: T): SerovalNode {
    return parseSOS(this._p, this.depth, current);
  }
}

export interface StreamParserContextOptions extends SyncParserContextOptions {
  /**
   * Receives each parsed record. Returning a promise defers the next record,
   * and the acceptance of the source event that produced it, until the
   * promise settles.
   */
  onParse: (node: SerovalNode, initial: boolean) => void | PromiseLike<void>;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}

export interface StreamParserContext {
  type: ParserMode.Stream;
  base: BaseParserContext;
  state: StreamParserState;
}
export interface OutputRecord {
  // `undefined` while the value is still being parsed, or if that failed.
  node: SerovalNode | undefined;
  initial: boolean;
  // Releases the live stream event behind this record once it is emitted.
  accept: (() => void) | undefined;
}

export interface StreamParserState {
  // Life cycle
  alive: boolean;
  // Number of pending things
  pending: number;
  // Depth of synchronous parses in progress. Records are held back until the
  // record that introduces their references has been queued.
  parsing: number;
  // Records waiting to be emitted, in order.
  queue: OutputRecord[];
  // An output callback returned a promise that has not settled yet.
  writing: boolean;
  // Why the parse stopped early, handed to live stream sources on cleanup.
  reason: unknown;
  // Callbacks
  onParse: (node: SerovalNode, initial: boolean) => void | PromiseLike<void>;
  onError?: (error: unknown) => void;
  onDone?: () => void;

  cleanups: (() => void)[];

  // Streaming-mode behavior, set by `createStreamParserContext` so that
  // synchronous consumers never bundle it.
  stream: (
    ctx: StreamParserContext,
    depth: number,
    id: number,
    current: Stream<unknown>,
  ) => void;
  live: (
    ctx: StreamParserContext,
    depth: number,
    id: number,
    current: LiveStream<unknown>,
  ) => void;
  promise: (
    ctx: StreamParserContext,
    resolver: number,
    depth: number,
    current: Promise<unknown>,
  ) => void;
  iterable: (
    ctx: StreamParserContext,
    depth: number,
    id: number,
    current: AsyncIterable<unknown>,
  ) => void;
  plugin: (
    ctx: StreamParserContext,
    depth: number,
    id: number,
    current: unknown,
    plugins: Plugin<any, any>[],
  ) => SerovalPluginNode | undefined;
}

type SOSParserContext = SyncParserContext | StreamParserContext;

function parseItems(
  ctx: SOSParserContext,
  depth: number,
  current: unknown[],
): (SerovalNode | 0)[] {
  const len = current.length;
  const nodes: (SerovalNode | 0)[] = new Array(len);
  for (let i = 0; i < len; i++) {
    if (i in current) {
      nodes[i] = parseSOS(ctx, depth, current[i]);
    } else {
      nodes[i] = 0;
    }
  }
  return nodes;
}

function parseArray(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: unknown[],
): SerovalArrayNode {
  return createArrayNode(id, current, parseItems(ctx, depth, current));
}

function parseProperties(
  ctx: SOSParserContext,
  depth: number,
  properties: Record<string | symbol, unknown>,
): SerovalObjectRecordNode {
  const keys = Object.keys(properties);
  const len = keys.length;
  // Sized up front: `push` from empty over-allocates the backing store for
  // every object, and the length is already known.
  const keyNodes: SerovalObjectRecordKey[] = new Array(len);
  const valueNodes: SerovalNode[] = new Array(len);
  for (let i = 0, key: string; i < len; i++) {
    key = keys[i];
    keyNodes[i] = serializeString(key);
    valueNodes[i] = parseSOS(ctx, depth, properties[key]);
  }
  // Check special properties, symbols in this case
  if (SYM_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
        SerovalNodeType.IteratorFactoryInstance,
        parseIteratorFactory(ctx.base),
        parseSOS(
          ctx,
          depth,
          createSequenceFromIterable(
            properties as unknown as Iterable<unknown>,
          ),
        ) as SerovalNodeWithID,
      ),
    );
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ASYNC_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
        SerovalNodeType.AsyncIteratorFactoryInstance,
        parseAsyncIteratorFactory(ctx.base),
        parseAsyncIterable(
          ctx,
          depth,
          properties as unknown as AsyncIterable<unknown>,
        ) as SerovalNodeWithID,
      ),
    );
  }
  if (SYM_TO_STRING_TAG in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_TO_STRING_TAG));
    valueNodes.push(createStringNode(properties[SYM_TO_STRING_TAG] as string));
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_IS_CONCAT_SPREADABLE));
    valueNodes.push(
      properties[SYM_IS_CONCAT_SPREADABLE] ? TRUE_NODE : FALSE_NODE,
    );
  }
  return {
    k: keyNodes,
    v: valueNodes,
  };
}

function parseAsyncIterable(
  ctx: SOSParserContext,
  depth: number,
  current: AsyncIterable<unknown>,
): SerovalNode {
  // The node only needs an id; in streaming mode the parser drives the
  // iterator, in sync mode it stays empty.
  const id = createIndexForValue(ctx.base, {});
  const result = createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    [],
  );
  if (ctx.type === ParserMode.Stream) {
    ctx.state.iterable(ctx, depth, id, current);
  }
  return result;
}

function parsePlainObject(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): ObjectLikeNode {
  return createObjectNode(
    id,
    current,
    empty,
    parseProperties(ctx, depth, current),
  );
}

function parseBoxed(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: object,
): SerovalBoxedNode {
  return createBoxedNode(id, parseSOS(ctx, depth, current.valueOf()));
}

function parseTypedArray(
  ctx: SOSParserContext,
  depth: number,
  type: SerovalNodeType.TypedArray | SerovalNodeType.BigIntTypedArray,
  id: number,
  current: TypedArrayValue | BigIntTypedArrayValue,
): SerovalTypedArrayNode | SerovalBigIntTypedArrayNode {
  current = getArrayBufferView(ctx.base, current);
  return createTypedArrayNode(
    type,
    id,
    current,
    parseSOS(ctx, depth, current.buffer),
  );
}

function parseDataView(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: DataView,
): SerovalDataViewNode {
  current = getArrayBufferView(ctx.base, current);
  return createDataViewNode(id, current, parseSOS(ctx, depth, current.buffer));
}

function parseError(
  ctx: SOSParserContext,
  depth: number,
  type: SerovalNodeType.Error | SerovalNodeType.AggregateError,
  id: number,
  current: Error,
): SerovalErrorNode | SerovalAggregateErrorNode {
  const options = getErrorOptions(current, ctx.base.features);
  return createErrorNode(
    type,
    id,
    current,
    options ? parseProperties(ctx, depth, options) : NIL,
  );
}

function parseMap(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Map<unknown, unknown>,
): SerovalMapNode {
  const keyNodes: SerovalNode[] = new Array(current.size);
  const valueNodes: SerovalNode[] = new Array(current.size);
  let i = 0;
  for (const [key, value] of current.entries()) {
    keyNodes[i] = parseSOS(ctx, depth, key);
    valueNodes[i] = parseSOS(ctx, depth, value);
    i++;
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes);
}

function parseSet(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Set<unknown>,
): SerovalSetNode {
  const items: SerovalNode[] = new Array(current.size);
  let i = 0;
  for (const item of current.keys()) {
    items[i++] = parseSOS(ctx, depth, item);
  }
  return createSetNode(id, items);
}

function parseStream(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Stream<unknown>,
): SerovalNode {
  const result = createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    [],
  );
  if (ctx.type === ParserMode.Stream) {
    ctx.state.stream(ctx, depth, id, current);
  }
  return result;
}

function parseLiveStream(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: LiveStream<unknown>,
): SerovalNode {
  const result = createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    [],
  );
  if (ctx.type === ParserMode.Stream) {
    ctx.state.live(ctx, depth, id, current);
  }
  return result;
}

function parsePromise(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Promise<unknown>,
): SerovalPromiseConstructorNode {
  // Creates a unique reference for the promise resolver
  const resolver = createIndexForValue(ctx.base, {});
  if (ctx.type === ParserMode.Stream) {
    ctx.state.promise(ctx, resolver, depth, current);
  }
  return createPromiseConstructorNode(ctx.base, id, resolver);
}

function parsePluginSync(
  ctx: SyncParserContext,
  depth: number,
  id: number,
  current: unknown,
  currentPlugins: Plugin<any, any>[],
): SerovalPluginNode | undefined {
  for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.parse.sync && plugin.test(current)) {
      return createPluginNode(
        id,
        plugin.tag,
        plugin.parse.sync(current, new SyncParsePluginContext(ctx, depth), {
          id,
        }),
      );
    }
  }
  return NIL;
}

function parsePlugin(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: unknown,
): SerovalPluginNode | undefined {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) {
    return ctx.type === ParserMode.Sync
      ? parsePluginSync(ctx, depth, id, current, currentPlugins)
      : ctx.state.plugin(ctx, depth, id, current, currentPlugins);
  }
  return NIL;
}

function parseSequence(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Sequence,
): SerovalSequenceNode {
  const len = current.v.length;
  const nodes: SerovalNode[] = new Array(len);
  for (let i = 0; i < len; i++) {
    nodes[i] = parseSOS(ctx, depth, current.v[i]);
  }
  return createSequenceNode(id, nodes, current.t, current.d);
}

function parseObjectPhase2(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: object,
  currentClass: unknown,
): SerovalNode {
  // Plain objects dominate real payloads; skip the classifier for them.
  if (currentClass === Object) {
    return parsePlainObject(
      ctx,
      depth,
      id,
      current as Record<string, unknown>,
      false,
    );
  }
  switch (getObjectKind(current, currentClass, ctx.base.features)) {
    case ObjectKind.NullObject:
      return parsePlainObject(
        ctx,
        depth,
        id,
        current as Record<string, unknown>,
        true,
      );
    case ObjectKind.Date:
      return createDateNode(id, current as unknown as Date);
    case ObjectKind.Error:
      return parseError(
        ctx,
        depth,
        SerovalNodeType.Error,
        id,
        current as unknown as Error,
      );
    case ObjectKind.AggregateError:
      return parseError(
        ctx,
        depth,
        SerovalNodeType.AggregateError,
        id,
        current as unknown as AggregateError,
      );
    case ObjectKind.Boxed:
      return parseBoxed(ctx, depth, id, current);
    case ObjectKind.ArrayBuffer:
      return createArrayBufferNode(
        ctx.base,
        id,
        current as unknown as ArrayBuffer,
      );
    case ObjectKind.TypedArray:
      return parseTypedArray(
        ctx,
        depth,
        SerovalNodeType.TypedArray,
        id,
        current as unknown as TypedArrayValue,
      );
    case ObjectKind.BigIntTypedArray:
      return parseTypedArray(
        ctx,
        depth,
        SerovalNodeType.BigIntTypedArray,
        id,
        current as unknown as BigIntTypedArrayValue,
      );
    case ObjectKind.DataView:
      return parseDataView(ctx, depth, id, current as unknown as DataView);
    case ObjectKind.Map:
      return parseMap(
        ctx,
        depth,
        id,
        current as unknown as Map<unknown, unknown>,
      );
    case ObjectKind.Set:
      return parseSet(ctx, depth, id, current as unknown as Set<unknown>);
    case ObjectKind.Promise:
      return parsePromise(
        ctx,
        depth,
        id,
        current as unknown as Promise<unknown>,
      );
    case ObjectKind.RegExp:
      return createRegExpNode(id, current as unknown as RegExp);
    case ObjectKind.Temporal:
      return createTemporalNode(
        id,
        getTemporalType(currentClass) as SerovalTemporalType,
        current as unknown as Temporal.Instant,
      );
    case ObjectKind.Iterable:
      // Generator objects have no global constructor despite existing
      return parsePlainObject(
        ctx,
        depth,
        id,
        current as Record<string, unknown>,
        !!currentClass,
      );
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

function parseObject(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: object,
): SerovalNode {
  if (Array.isArray(current)) {
    return parseArray(ctx, depth, id, current);
  }
  if (isStream(current)) {
    return isLiveStream(current)
      ? parseLiveStream(ctx, depth, id, current)
      : parseStream(ctx, depth, id, current);
  }
  if (isSequence(current)) {
    return parseSequence(ctx, depth, id, current);
  }
  const currentClass = getObjectClass(current);
  if (currentClass === OpaqueReference) {
    return parseSOS(
      ctx,
      depth,
      (current as OpaqueReference<unknown, unknown>).replacement,
    );
  }
  const parsed = parsePlugin(ctx, depth, id, current);
  if (parsed) {
    return parsed;
  }
  return parseObjectPhase2(ctx, depth, id, current, currentClass);
}

function parseFunction(
  ctx: SOSParserContext,
  depth: number,
  current: unknown,
): SerovalNode {
  const ref = getReferenceNode(ctx.base, current);
  if (typeof ref !== 'number') {
    return ref;
  }
  const plugin = parsePlugin(ctx, depth, ref, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

export function parseSOS<T>(
  ctx: SOSParserContext,
  depth: number,
  current: T,
): SerovalNode {
  if (depth >= ctx.base.depthLimit) {
    throw new SerovalDepthLimitError(ctx.base.depthLimit);
  }
  switch (typeof current) {
    case 'boolean':
      return current ? TRUE_NODE : FALSE_NODE;
    case 'undefined':
      return UNDEFINED_NODE;
    case 'string':
      return createStringNode(current as string);
    case 'number':
      return createNumberNode(current as number);
    case 'bigint':
      return createBigIntNode(current as bigint);
    case 'object': {
      if (current) {
        const ref = getReferenceNode(ctx.base, current);
        return typeof ref === 'number'
          ? parseObject(ctx, depth + 1, ref, current as object)
          : ref;
      }
      return NULL_NODE;
    }
    case 'symbol':
      return parseWellKnownSymbol(ctx.base, current);
    case 'function': {
      return parseFunction(ctx, depth, current);
    }
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

export function parseTop<T>(ctx: SyncParserContext, current: T): SerovalNode {
  try {
    return parseSOS(ctx, 0, current);
  } catch (error) {
    throw error instanceof SerovalParserError
      ? error
      : new SerovalParserError(error);
  }
}
