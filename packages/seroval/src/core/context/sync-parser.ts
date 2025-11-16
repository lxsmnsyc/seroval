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
  createSetNode,
  createStreamConstructorNode,
  createStreamNextNode,
  createStreamReturnNode,
  createStreamThrowNode,
  createStringNode,
  createTypedArrayNode,
} from '../base-primitives';
import { Feature } from '../compat';
import { NIL, SerovalNodeType } from '../constants';
import { SerovalParserError, SerovalUnsupportedTypeError } from '../errors';
import { FALSE_NODE, NULL_NODE, TRUE_NODE, UNDEFINED_NODE } from '../literals';
import { createSerovalNode } from '../node';
import { OpaqueReference } from '../opaque-reference';
import { type Plugin, SerovalMode } from '../plugin';
import { SpecialReference } from '../special-reference';
import type { Stream } from '../stream';
import {
  createStream,
  createStreamFromAsyncIterable,
  isStream,
} from '../stream';
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
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from '../types';
import { getErrorOptions } from '../utils/error';
import { iteratorToSequence } from '../utils/iterator-to-sequence';
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
  getReferenceNode,
  parseAsyncIteratorFactory,
  parseIteratorFactory,
  ParserNodeType,
  parseSpecialReference,
  parseWellKnownSymbol,
} from './parser';

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode;

export type SyncParserContextOptions = BaseParserContextOptions;

const enum ParserMode {
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
    child: undefined,
  };
}

export class SyncParsePluginContext {
  constructor(private _p: SyncParserContext) {}

  parse<T>(current: T): SerovalNode {
    return parseSOS(this._p, current);
  }
}

export interface StreamParserContextOptions extends SyncParserContextOptions {
  onParse: (node: SerovalNode, initial: boolean) => void;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}

export interface StreamParserContext {
  type: ParserMode.Stream;
  base: BaseParserContext;
  child: StreamParsePluginContext | undefined;
  state: StreamParserState;
}
export class StreamParsePluginContext {
  constructor(private _p: StreamParserContext) {}

  parse<T>(current: T): SerovalNode {
    return parseSOS(this._p, current);
  }

  parseWithError<T>(current: T): SerovalNode | undefined {
    return parseWithError(this._p, current);
  }

  isAlive(): boolean {
    return this._p.state.alive;
  }

  pushPendingState(): void {
    pushPendingState(this._p);
  }

  popPendingState(): void {
    popPendingState(this._p);
  }

  onParse(node: SerovalNode): void {
    onParse(this._p, node);
  }

  onError(error: unknown): void {
    onError(this._p, error);
  }
}

interface StreamParserState {
  // Life cycle
  alive: boolean;
  // Number of pending things
  pending: number;
  //
  initial: boolean;
  //
  buffer: SerovalNode[];
  // Callbacks
  onParse: (node: SerovalNode, initial: boolean) => void;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}

function createStreamParserState(
  options: StreamParserContextOptions,
): StreamParserState {
  return {
    alive: true,
    pending: 0,
    initial: true,
    buffer: [],
    onParse: options.onParse,
    onError: options.onError,
    onDone: options.onDone,
  };
}

export function createStreamParserContext(
  options: StreamParserContextOptions,
): StreamParserContext {
  return {
    type: ParserMode.Stream,
    base: createBaseParserContext(SerovalMode.Cross, options),
    child: undefined,
    state: createStreamParserState(options),
  };
}

type SOSParserContext = SyncParserContext | StreamParserContext;

function parseItems(ctx: SOSParserContext, current: unknown[]): SerovalNode[] {
  const nodes = [];
  for (let i = 0, len = current.length; i < len; i++) {
    if (i in current) {
      nodes[i] = parseSOS(ctx, current[i]);
    }
  }
  return nodes;
}

function parseArray(
  ctx: SOSParserContext,
  id: number,
  current: unknown[],
): SerovalArrayNode {
  return createArrayNode(id, current, parseItems(ctx, current));
}

function parseProperties(
  ctx: SOSParserContext,
  properties: Record<string | symbol, unknown>,
): SerovalObjectRecordNode {
  const entries = Object.entries(properties);
  const keyNodes: SerovalObjectRecordKey[] = [];
  const valueNodes: SerovalNode[] = [];
  for (let i = 0, len = entries.length; i < len; i++) {
    keyNodes.push(serializeString(entries[i][0]));
    valueNodes.push(parseSOS(ctx, entries[i][1]));
  }
  // Check special properties, symbols in this case
  if (SYM_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
        parseIteratorFactory(ctx.base),
        parseSOS(
          ctx,
          iteratorToSequence(properties as unknown as Iterable<unknown>),
        ),
      ),
    );
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ASYNC_ITERATOR));
    valueNodes.push(
      createAsyncIteratorFactoryInstanceNode(
        parseAsyncIteratorFactory(ctx.base),
        parseSOS(
          ctx,
          ctx.type === ParserMode.Sync
            ? createStream()
            : createStreamFromAsyncIterable(
                properties as unknown as AsyncIterable<unknown>,
              ),
        ),
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
    s: keyNodes.length,
  };
}

function parsePlainObject(
  ctx: SOSParserContext,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): ObjectLikeNode {
  return createObjectNode(id, current, empty, parseProperties(ctx, current));
}

function parseBoxed(
  ctx: SOSParserContext,
  id: number,
  current: object,
): SerovalBoxedNode {
  return createBoxedNode(id, parseSOS(ctx, current.valueOf()));
}

function parseTypedArray(
  ctx: SOSParserContext,
  id: number,
  current: TypedArrayValue,
): SerovalTypedArrayNode {
  return createTypedArrayNode(id, current, parseSOS(ctx, current.buffer));
}

function parseBigIntTypedArray(
  ctx: SOSParserContext,
  id: number,
  current: BigIntTypedArrayValue,
): SerovalBigIntTypedArrayNode {
  return createBigIntTypedArrayNode(id, current, parseSOS(ctx, current.buffer));
}

function parseDataView(
  ctx: SOSParserContext,
  id: number,
  current: DataView,
): SerovalDataViewNode {
  return createDataViewNode(id, current, parseSOS(ctx, current.buffer));
}

function parseError(
  ctx: SOSParserContext,
  id: number,
  current: Error,
): SerovalErrorNode {
  const options = getErrorOptions(current, ctx.base.features);
  return createErrorNode(
    id,
    current,
    options ? parseProperties(ctx, options) : NIL,
  );
}

function parseAggregateError(
  ctx: SOSParserContext,
  id: number,
  current: AggregateError,
): SerovalAggregateErrorNode {
  const options = getErrorOptions(current, ctx.base.features);
  return createAggregateErrorNode(
    id,
    current,
    options ? parseProperties(ctx, options) : NIL,
  );
}

function parseMap(
  ctx: SOSParserContext,
  id: number,
  current: Map<unknown, unknown>,
): SerovalMapNode {
  const keyNodes: SerovalNode[] = [];
  const valueNodes: SerovalNode[] = [];
  for (const [key, value] of current.entries()) {
    keyNodes.push(parseSOS(ctx, key));
    valueNodes.push(parseSOS(ctx, value));
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes, current.size);
}

function parseSet(
  ctx: SOSParserContext,
  id: number,
  current: Set<unknown>,
): SerovalSetNode {
  const items: SerovalNode[] = [];
  for (const item of current.keys()) {
    items.push(parseSOS(ctx, item));
  }
  return createSetNode(id, current.size, items);
}

function parseStream(
  ctx: SOSParserContext,
  id: number,
  current: Stream<unknown>,
): SerovalNode {
  const result = createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    [],
  );
  if (ctx.type === ParserMode.Sync) {
    return result;
  }
  pushPendingState(ctx);
  current.on({
    next: value => {
      if (ctx.state.alive) {
        const parsed = parseWithError(ctx, value);
        if (parsed) {
          onParse(ctx, createStreamNextNode(id, parsed));
        }
      }
    },
    throw: value => {
      if (ctx.state.alive) {
        const parsed = parseWithError(ctx, value);
        if (parsed) {
          onParse(ctx, createStreamThrowNode(id, parsed));
        }
      }
      popPendingState(ctx);
    },
    return: value => {
      if (ctx.state.alive) {
        const parsed = parseWithError(ctx, value);
        if (parsed) {
          onParse(ctx, createStreamReturnNode(id, parsed));
        }
      }
      popPendingState(ctx);
    },
  });
  return result;
}

function handlePromiseSuccess(
  this: StreamParserContext,
  id: number,
  data: unknown,
): void {
  if (this.state.alive) {
    const parsed = parseWithError(this, data);
    if (parsed) {
      onParse(
        this,
        createSerovalNode(
          SerovalNodeType.PromiseSuccess,
          id,
          NIL,
          NIL,
          NIL,
          NIL,
          NIL,
          NIL,
          [
            parseSpecialReference(this.base, SpecialReference.PromiseSuccess),
            parsed,
          ],
          NIL,
          NIL,
          NIL,
        ),
      );
    }
    popPendingState(this);
  }
}

function handlePromiseFailure(
  this: StreamParserContext,
  id: number,
  data: unknown,
): void {
  if (this.state.alive) {
    const parsed = parseWithError(this, data);
    if (parsed) {
      onParse(
        this,
        createSerovalNode(
          SerovalNodeType.PromiseFailure,
          id,
          NIL,
          NIL,
          NIL,
          NIL,
          NIL,
          NIL,
          [
            parseSpecialReference(this.base, SpecialReference.PromiseFailure),
            parsed,
          ],
          NIL,
          NIL,
          NIL,
        ),
      );
    }
  }
  popPendingState(this);
}

function parsePromise(
  ctx: SOSParserContext,
  id: number,
  current: Promise<unknown>,
): SerovalPromiseConstructorNode {
  // Creates a unique reference for the promise resolver
  const resolver = createIndexForValue(ctx.base, {});
  if (ctx.type === ParserMode.Stream) {
    pushPendingState(ctx);
    current.then(
      handlePromiseSuccess.bind(ctx, resolver),
      handlePromiseFailure.bind(ctx, resolver),
    );
  }
  return createPromiseConstructorNode(ctx.base, id, resolver);
}

function parsePluginSync(
  ctx: SyncParserContext,
  id: number,
  current: unknown,
  currentPlugins: Plugin<any, any>[],
): SerovalPluginNode | undefined {
  for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.parse.sync && plugin.test(current)) {
      if (ctx.child == null) {
        ctx.child = new SyncParsePluginContext(ctx);
      }
      return createPluginNode(
        id,
        plugin.tag,
        plugin.parse.sync(current, ctx.child, {
          id,
        }),
      );
    }
  }
  return undefined;
}

function parsePluginStream(
  ctx: StreamParserContext,
  id: number,
  current: unknown,
  currentPlugins: Plugin<any, any>[],
): SerovalPluginNode | undefined {
  for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.parse.stream && plugin.test(current)) {
      if (ctx.child == null) {
        ctx.child = new StreamParsePluginContext(ctx);
      }
      return createPluginNode(
        id,
        plugin.tag,
        plugin.parse.stream(current, ctx.child, {
          id,
        }),
      );
    }
  }
  return undefined;
}

function parsePlugin(
  ctx: SOSParserContext,
  id: number,
  current: unknown,
): SerovalPluginNode | undefined {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) {
    return ctx.type === ParserMode.Sync
      ? parsePluginSync(ctx, id, current, currentPlugins)
      : parsePluginStream(ctx, id, current, currentPlugins);
  }
  return undefined;
}

function parseObjectPhase2(
  ctx: SOSParserContext,
  id: number,
  current: object,
  currentClass: unknown,
): SerovalNode {
  switch (currentClass) {
    case Object:
      return parsePlainObject(
        ctx,
        id,
        current as Record<string, unknown>,
        false,
      );
    case undefined:
      return parsePlainObject(
        ctx,
        id,
        current as Record<string, unknown>,
        true,
      );
    case Date:
      return createDateNode(id, current as unknown as Date);
    case RegExp:
      return createRegExpNode(id, current as unknown as RegExp);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return parseError(ctx, id, current as unknown as Error);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return parseBoxed(ctx, id, current);
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
      return parseTypedArray(ctx, id, current as unknown as TypedArrayValue);
    case DataView:
      return parseDataView(ctx, id, current as unknown as DataView);
    case Map:
      return parseMap(ctx, id, current as unknown as Map<unknown, unknown>);
    case Set:
      return parseSet(ctx, id, current as unknown as Set<unknown>);
    default:
      break;
  }
  // Promises
  if (currentClass === Promise || current instanceof Promise) {
    return parsePromise(ctx, id, current as unknown as Promise<unknown>);
  }
  const currentFeatures = ctx.base.features;
  // BigInt Typed Arrays
  if (currentFeatures & Feature.BigIntTypedArray) {
    switch (currentClass) {
      case BigInt64Array:
      case BigUint64Array:
        return parseBigIntTypedArray(
          ctx,
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
    return parseAggregateError(ctx, id, current as unknown as AggregateError);
  }
  // Slow path. We only need to handle Errors and Iterators
  // since they have very broad implementations.
  if (current instanceof Error) {
    return parseError(ctx, id, current);
  }
  // Generator functions don't have a global constructor
  // despite existing
  if (SYM_ITERATOR in current || SYM_ASYNC_ITERATOR in current) {
    return parsePlainObject(ctx, id, current, !!currentClass);
  }
  throw new SerovalUnsupportedTypeError(current);
}

function parseObject(
  ctx: SOSParserContext,
  id: number,
  current: object,
): SerovalNode {
  if (Array.isArray(current)) {
    return parseArray(ctx, id, current);
  }
  if (isStream(current)) {
    return parseStream(ctx, id, current);
  }
  const currentClass = current.constructor;
  if (currentClass === OpaqueReference) {
    return parseSOS(
      ctx,
      (current as OpaqueReference<unknown, unknown>).replacement,
    );
  }
  const parsed = parsePlugin(ctx, id, current);
  if (parsed) {
    return parsed;
  }
  return parseObjectPhase2(ctx, id, current, currentClass);
}

function parseFunction(ctx: SOSParserContext, current: unknown): SerovalNode {
  const ref = getReferenceNode(ctx.base, current);
  if (ref.type !== ParserNodeType.Fresh) {
    return ref.value;
  }
  const plugin = parsePlugin(ctx, ref.value, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

export function parseSOS<T>(ctx: SOSParserContext, current: T): SerovalNode {
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
          ? parseObject(ctx, ref.value, current as object)
          : ref.value;
      }
      return NULL_NODE;
    }
    case 'symbol':
      return parseWellKnownSymbol(ctx.base, current);
    case 'function': {
      return parseFunction(ctx, current);
    }
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

export function parseTop<T>(ctx: SyncParserContext, current: T): SerovalNode {
  try {
    return parseSOS(ctx, current);
  } catch (error) {
    throw error instanceof SerovalParserError
      ? error
      : new SerovalParserError(error);
  }
}

function onParse(ctx: StreamParserContext, node: SerovalNode): void {
  // If the value emitted happens to be during parsing, we push to the
  // buffer and emit after the initial parsing is done.
  if (ctx.state.initial) {
    ctx.state.buffer.push(node);
  } else {
    onParseInternal(ctx, node, false);
  }
}

function onError(ctx: StreamParserContext, error: unknown): void {
  if (ctx.state.onError) {
    ctx.state.onError(error);
  } else {
    throw error instanceof SerovalParserError
      ? error
      : new SerovalParserError(error);
  }
}

function onDone(ctx: StreamParserContext): void {
  if (ctx.state.onDone) {
    ctx.state.onDone();
  }
}

function onParseInternal(
  ctx: StreamParserContext,
  node: SerovalNode,
  initial: boolean,
): void {
  try {
    ctx.state.onParse(node, initial);
  } catch (error) {
    onError(ctx, error);
  }
}

function pushPendingState(ctx: StreamParserContext): void {
  ctx.state.pending++;
}

function popPendingState(ctx: StreamParserContext): void {
  if (--ctx.state.pending <= 0) {
    onDone(ctx);
  }
}

export function parseWithError<T>(
  ctx: StreamParserContext,
  current: T,
): SerovalNode | undefined {
  try {
    return parseSOS(ctx, current);
  } catch (err) {
    onError(ctx, err);
    return NIL;
  }
}

export function startStreamParse<T>(
  ctx: StreamParserContext,
  current: T,
): void {
  const parsed = parseWithError(ctx, current);
  if (parsed) {
    onParseInternal(ctx, parsed, true);
    ctx.state.initial = false;
    flushStreamParse(ctx, ctx.state);

    // Check if there's any pending pushes
    if (ctx.state.pending <= 0) {
      destroyStreamParse(ctx);
    }
  }
}

function flushStreamParse(
  ctx: StreamParserContext,
  state: StreamParserState,
): void {
  for (let i = 0, len = state.buffer.length; i < len; i++) {
    onParseInternal(ctx, state.buffer[i], false);
  }
}

export function destroyStreamParse(ctx: StreamParserContext): void {
  if (ctx.state.alive) {
    onDone(ctx);
    ctx.state.alive = false;
  }
}
