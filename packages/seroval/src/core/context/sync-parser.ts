import {
  createAggregateErrorNode,
  createArrayNode,
  createAsyncIteratorFactoryInstanceNode,
  createBigIntNode,
  createBigIntTypedArrayNode,
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
import { Feature } from '../compat';
import { NIL, SerovalTemporalType } from '../constants';
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
  getReferenceNode,
  ParserNodeType,
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
  const nodes: (SerovalNode | 0)[] = [];
  for (let i = 0, len = current.length; i < len; i++) {
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
  const entries = Object.entries(properties);
  const keyNodes: SerovalObjectRecordKey[] = [];
  const valueNodes: SerovalNode[] = [];
  for (let i = 0, len = entries.length; i < len; i++) {
    keyNodes.push(serializeString(entries[i][0]));
    valueNodes.push(parseSOS(ctx, depth, entries[i][1]));
  }
  // Check special properties, symbols in this case
  if (SYM_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
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
      createAsyncIteratorFactoryInstanceNode(
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
  id: number,
  current: TypedArrayValue,
): SerovalTypedArrayNode {
  current = getArrayBufferView(ctx.base, current);
  return createTypedArrayNode(
    id,
    current,
    parseSOS(ctx, depth, current.buffer),
  );
}

function parseBigIntTypedArray(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: BigIntTypedArrayValue,
): SerovalBigIntTypedArrayNode {
  current = getArrayBufferView(ctx.base, current);
  return createBigIntTypedArrayNode(
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
  id: number,
  current: Error,
): SerovalErrorNode {
  const options = getErrorOptions(current, ctx.base.features);
  return createErrorNode(
    id,
    current,
    options ? parseProperties(ctx, depth, options) : NIL,
  );
}

function parseAggregateError(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: AggregateError,
): SerovalAggregateErrorNode {
  const options = getErrorOptions(current, ctx.base.features);
  return createAggregateErrorNode(
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
  const keyNodes: SerovalNode[] = [];
  const valueNodes: SerovalNode[] = [];
  for (const [key, value] of current.entries()) {
    keyNodes.push(parseSOS(ctx, depth, key));
    valueNodes.push(parseSOS(ctx, depth, value));
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes);
}

function parseSet(
  ctx: SOSParserContext,
  depth: number,
  id: number,
  current: Set<unknown>,
): SerovalSetNode {
  const items: SerovalNode[] = [];
  for (const item of current.keys()) {
    items.push(parseSOS(ctx, depth, item));
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
  const nodes: SerovalNode[] = [];
  for (let i = 0, len = current.v.length; i < len; i++) {
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
  switch (currentClass) {
    case Object:
      return parsePlainObject(
        ctx,
        depth,
        id,
        current as Record<string, unknown>,
        false,
      );
    case NIL:
      return parsePlainObject(
        ctx,
        depth,
        id,
        current as Record<string, unknown>,
        true,
      );
    case Date:
      return createDateNode(id, current as unknown as Date);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return parseError(ctx, depth, id, current as unknown as Error);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return parseBoxed(ctx, depth, id, current);
    case ArrayBuffer:
      return createArrayBufferNode(
        ctx.base,
        id,
        current as unknown as ArrayBuffer,
      );
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return parseTypedArray(
        ctx,
        depth,
        id,
        current as unknown as TypedArrayValue,
      );
    case DataView:
      return parseDataView(ctx, depth, id, current as unknown as DataView);
    case Map:
      return parseMap(
        ctx,
        depth,
        id,
        current as unknown as Map<unknown, unknown>,
      );
    case Set:
      return parseSet(ctx, depth, id, current as unknown as Set<unknown>);
    default:
      break;
  }
  // Promises
  if (currentClass === Promise || current instanceof Promise) {
    return parsePromise(ctx, depth, id, current as unknown as Promise<unknown>);
  }
  const currentFeatures = ctx.base.features;
  if (currentFeatures & Feature.RegExp && currentClass === RegExp) {
    return createRegExpNode(id, current as unknown as RegExp);
  }
  // BigInt Typed Arrays
  if (currentFeatures & Feature.BigIntTypedArray) {
    switch (currentClass) {
      case BigInt64Array:
      case BigUint64Array:
        return parseBigIntTypedArray(
          ctx,
          depth,
          id,
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
    return parseAggregateError(
      ctx,
      depth,
      id,
      current as unknown as AggregateError,
    );
  }
  if (currentFeatures & Feature.Temporal && typeof Temporal !== 'undefined') {
    switch (currentClass) {
      case Temporal.Instant:
        return createTemporalNode(
          id,
          SerovalTemporalType.Instant,
          current as unknown as Temporal.Instant,
        );
      case Temporal.Duration:
        return createTemporalNode(
          id,
          SerovalTemporalType.Duration,
          current as unknown as Temporal.Duration,
        );
      case Temporal.PlainDate:
        return createTemporalNode(
          id,
          SerovalTemporalType.PlainDate,
          current as unknown as Temporal.PlainDate,
        );
      case Temporal.PlainDateTime:
        return createTemporalNode(
          id,
          SerovalTemporalType.PlainDateTime,
          current as unknown as Temporal.PlainDateTime,
        );
      case Temporal.PlainMonthDay:
        return createTemporalNode(
          id,
          SerovalTemporalType.PlainMonthDay,
          current as unknown as Temporal.PlainMonthDay,
        );
      case Temporal.PlainTime:
        return createTemporalNode(
          id,
          SerovalTemporalType.PlainTime,
          current as unknown as Temporal.PlainTime,
        );
      case Temporal.PlainYearMonth:
        return createTemporalNode(
          id,
          SerovalTemporalType.PlainYearMonth,
          current as unknown as Temporal.PlainYearMonth,
        );
      case Temporal.ZonedDateTime:
        return createTemporalNode(
          id,
          SerovalTemporalType.ZonedDateTime,
          current as unknown as Temporal.ZonedDateTime,
        );
      default:
        break;
    }
  }
  // Slow path. We only need to handle Errors and Iterators
  // since they have very broad implementations.
  if (current instanceof Error) {
    return parseError(ctx, depth, id, current);
  }
  // Generator functions don't have a global constructor
  // despite existing
  if (SYM_ITERATOR in current || SYM_ASYNC_ITERATOR in current) {
    return parsePlainObject(ctx, depth, id, current, !!currentClass);
  }
  throw new SerovalUnsupportedTypeError(current);
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
  let currentClass: unknown = current.constructor;
  // `constructor` is an ordinary own property, so data can shadow it
  // (`JSON.parse('{"constructor":1}')`) and hide the real class. A class is
  // always callable, so anything else means the lookup was shadowed — only
  // then fall back to the prototype, keeping the common path free of it.
  if (currentClass !== NIL && typeof currentClass !== 'function') {
    const proto = Object.getPrototypeOf(current) as object | null;
    currentClass = proto === null ? NIL : proto.constructor;
  }
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
  if (ref.type !== ParserNodeType.Fresh) {
    return ref.value;
  }
  const plugin = parsePlugin(ctx, depth, ref.value, current);
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
        return ref.type === ParserNodeType.Fresh
          ? parseObject(ctx, depth + 1, ref.value, current as object)
          : ref.value;
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
