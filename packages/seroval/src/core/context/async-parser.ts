import {
  createArrayNode,
  createBigIntNode,
  createBoxedNode,
  createDateNode,
  createErrorNode,
  createIteratorFactoryInstanceNode,
  createNumberNode,
  createPluginNode,
  createRegExpNode,
  createSequenceNode,
  createSetNode,
  createStreamConstructorNode,
  createStreamEventNode,
  createStringNode,
  createTemporalNode,
  createViewNode,
} from '../base-primitives';
import { NIL, SerovalNodeType } from '../constants';
import { SerovalDepthLimitError, SerovalParserError, SerovalUnsupportedTypeError } from '../errors';
import { FALSE_NODE, NULL_NODE, TRUE_NODE, UNDEFINED_NODE } from '../literals';
import { type LiveStream, isLiveStream } from '../live-stream';
import { createSerovalNode } from '../node';
import { OpaqueReference } from '../opaque-reference';
import type { Plugin } from '../plugin';
import { type Sequence, createSequenceFromIterable, isSequence } from '../sequence';
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
  SerovalPromiseNode,
  SerovalSequenceNode,
  SerovalSetNode,
  SerovalStreamConstructorNode,
  SerovalTypedArrayNode,
} from '../types';
import { getErrorOptions } from '../utils/error';
import promiseToResult from '../utils/promise-to-result';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../utils/typed-array';
import type { BaseParserContext, BaseParserContextOptions } from './parser';
import {
  ObjectKind,
  createArrayBufferNode,
  createBaseParserContext,
  createIndexForValue,
  createMapNode,
  createObjectNode,
  getArrayBufferView,
  getObjectClass,
  getObjectKind,
  getReferenceNode,
  getTemporalType,
  markParserRef,
  parseAsyncIteratorFactory,
  parseIteratorFactory,
  parseSpecialReference,
  parseWellKnownSymbol,
} from './parser';

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode | SerovalPromiseNode;

export type AsyncParserContextOptions = BaseParserContextOptions;

export interface AsyncParserContext {
  base: BaseParserContext;
}

export function createAsyncParserContext(options: AsyncParserContextOptions): AsyncParserContext {
  return {
    base: createBaseParserContext(options),
  };
}

export interface AsyncParsePluginContext {
  parse<T>(current: T): Promise<SerovalNode>;
  parseStreamSource(current: AsyncIterable<unknown>): Promise<SerovalNode>;
}

// Only objects and functions can produce a Promise; awaiting a plain node
// would still cost a microtask turn per primitive.
type MaybeAsyncNode = SerovalNode | Promise<SerovalNode>;

async function parseItems(
  ctx: AsyncParserContext,
  depth: number,
  current: unknown[],
): Promise<(SerovalNode | 0)[]> {
  const len = current.length;
  const nodes = new Array<SerovalNode | 0>(len);
  for (let i = 0, node: MaybeAsyncNode; i < len; i++) {
    // For consistency in holes
    if (i in current) {
      node = parseValueAsync(ctx, depth, current[i]);
      nodes[i] = node instanceof Promise ? await node : node;
    } else {
      nodes[i] = 0;
    }
  }
  return nodes;
}

async function parseArray(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: unknown[],
): Promise<SerovalArrayNode> {
  return createArrayNode(id, current, await parseItems(ctx, depth, current));
}

async function parseProperties(
  ctx: AsyncParserContext,
  depth: number,
  properties: Record<string | symbol, unknown>,
): Promise<SerovalObjectRecordNode> {
  const keys = Object.keys(properties);
  const len = keys.length;
  // Sized up front: `push` from empty over-allocates the backing store for
  // every object, and the length is already known.
  const keyNodes = new Array<SerovalObjectRecordKey>(len);
  const valueNodes = new Array<SerovalNode>(len);
  for (let i = 0, key: string, node: MaybeAsyncNode; i < len; i++) {
    key = keys[i];
    keyNodes[i] = serializeString(key);
    node = parseValueAsync(ctx, depth, properties[key]);
    valueNodes[i] = node instanceof Promise ? await node : node;
  }
  // Check special properties
  if (SYM_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
        SerovalNodeType.IteratorFactoryInstance,
        parseIteratorFactory(ctx.base),
        (await parseAsync(
          ctx,
          depth,
          createSequenceFromIterable(properties as unknown as Iterable<unknown>),
        )) as SerovalNodeWithID,
      ),
    );
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ASYNC_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
        SerovalNodeType.AsyncIteratorFactoryInstance,
        parseAsyncIteratorFactory(ctx.base),
        await parseAsyncIterable(ctx, depth, properties as unknown as AsyncIterable<unknown>),
      ),
    );
  }
  if (SYM_TO_STRING_TAG in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_TO_STRING_TAG));
    valueNodes.push(createStringNode(properties[SYM_TO_STRING_TAG] as string));
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_IS_CONCAT_SPREADABLE));
    valueNodes.push(properties[SYM_IS_CONCAT_SPREADABLE] ? TRUE_NODE : FALSE_NODE);
  }
  return {
    k: keyNodes,
    v: valueNodes,
  };
}

async function parsePlainObject(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): Promise<ObjectLikeNode> {
  return createObjectNode(id, current, empty, await parseProperties(ctx, depth, current));
}

// TODO: check if parseBoxedSync can be used
async function parseBoxed(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: object,
): Promise<SerovalBoxedNode> {
  return createBoxedNode(id, await parseAsync(ctx, depth, current.valueOf()));
}

async function parseView(
  ctx: AsyncParserContext,
  depth: number,
  type: SerovalNodeType.TypedArray | SerovalNodeType.BigIntTypedArray | SerovalNodeType.DataView,
  id: number,
  current: TypedArrayValue | BigIntTypedArrayValue | DataView,
): Promise<SerovalTypedArrayNode | SerovalBigIntTypedArrayNode | SerovalDataViewNode> {
  current = getArrayBufferView(ctx.base, current);
  return createViewNode(type, id, current, await parseAsync(ctx, depth, current.buffer));
}

async function parseError(
  ctx: AsyncParserContext,
  depth: number,
  type: SerovalNodeType.Error | SerovalNodeType.AggregateError,
  id: number,
  current: Error,
): Promise<SerovalErrorNode | SerovalAggregateErrorNode> {
  const options = getErrorOptions(current, ctx.base.features);
  return createErrorNode(
    type,
    id,
    current,
    options ? await parseProperties(ctx, depth, options) : NIL,
  );
}

async function parseMap(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Map<unknown, unknown>,
): Promise<SerovalMapNode> {
  const keyNodes = new Array<SerovalNode>(current.size);
  const valueNodes = new Array<SerovalNode>(current.size);
  let node: MaybeAsyncNode;
  let i = 0;
  for (const [key, value] of current.entries()) {
    node = parseValueAsync(ctx, depth, key);
    keyNodes[i] = node instanceof Promise ? await node : node;
    node = parseValueAsync(ctx, depth, value);
    valueNodes[i] = node instanceof Promise ? await node : node;
    i++;
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes);
}

async function parseSet(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Set<unknown>,
): Promise<SerovalSetNode> {
  const items = new Array<SerovalNode>(current.size);
  let node: MaybeAsyncNode;
  let i = 0;
  for (const item of current.keys()) {
    node = parseValueAsync(ctx, depth, item);
    items[i++] = node instanceof Promise ? await node : node;
  }
  return createSetNode(id, items);
}

async function parsePlugin(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: unknown,
  // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
  currentPlugins: Plugin<any, any>[] | undefined,
): Promise<SerovalPluginNode | undefined> {
  if (currentPlugins) {
    for (let i = 0, len = currentPlugins.length; i < len; i++) {
      const plugin = currentPlugins[i];
      if (plugin.parse.async && plugin.test(current)) {
        return createPluginNode(
          id,
          plugin.tag,
          // oxlint-disable-next-line no-unsafe-argument -- Plugin info is any because plugins are stored as Plugin<any, any>.
          await plugin.parse.async(
            current,
            {
              parse: (value): Promise<SerovalNode> => parseAsync(ctx, depth, value),
              parseStreamSource(source): Promise<SerovalNode> {
                if (depth >= ctx.base.depthLimit) {
                  throw new SerovalDepthLimitError(ctx.base.depthLimit);
                }
                return parseAsyncIterable(ctx, depth + 1, source);
              },
            },
            {
              id,
            },
          ),
        );
      }
    }
  }
  return NIL;
}

async function parsePromise(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Promise<unknown>,
): Promise<SerovalPromiseNode> {
  const [status, result] = await promiseToResult(current);

  return createSerovalNode(
    SerovalNodeType.Promise,
    id,
    status,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    await parseAsync(ctx, depth, result),
  );
}

function parseStreamHandle<T>(
  this: AsyncParserContext,
  depth: number,
  id: number,
  current: Stream<T> | LiveStream<T>,
  resolve: (value: SerovalNode[] | PromiseLike<SerovalNode[]>) => void,
  reject: (reason?: unknown) => void,
): void {
  // Reserve arrival order; a terminal event must wait for earlier parses.
  const sequence: (SerovalNode | undefined)[] = [];
  let unparsed = 0;
  let ended = false;
  let settled = false;
  const fail = (error: unknown): void => {
    if (!settled) {
      settled = true;
      try {
        // oxlint-disable-next-line no-use-before-define -- Only runs from async callbacks, after cleanup is set.
        cleanup(error);
      } catch {
        // A cleanup failure must not replace the parse failure.
      }
      reject(error);
    }
  };
  const handle =
    (
      type: SerovalNodeType.StreamNext | SerovalNodeType.StreamThrow | SerovalNodeType.StreamReturn,
    ) =>
    (value: unknown, accept?: () => void): void => {
      if (settled) {
        return;
      }
      markParserRef(this.base, id);
      const slot = sequence.push(NIL) - 1;
      unparsed++;
      if (type !== SerovalNodeType.StreamNext) {
        ended = true;
      }
      parseAsync(this, depth, value).then((data) => {
        if (!settled) {
          sequence[slot] = createStreamEventNode(type, id, data);
          unparsed--;
          accept?.();
          if (ended && unparsed === 0) {
            settled = true;
            try {
              // oxlint-disable-next-line no-use-before-define -- Only runs from async callbacks, after cleanup is set.
              cleanup();
            } catch (error) {
              reject(error);
              return;
            }
            // Every reserved slot has been filled.
            resolve(sequence as SerovalNode[]);
          }
        }
      }, fail);
    };
  const listener = {
    next: handle(SerovalNodeType.StreamNext),
    throw: handle(SerovalNodeType.StreamThrow),
    return: handle(SerovalNodeType.StreamReturn),
  };
  const cleanup: (reason?: unknown) => void = isLiveStream(current)
    ? current.pump(listener)
    : current.on(listener);
}

async function parseStream(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Stream<unknown> | LiveStream<unknown>,
): Promise<SerovalStreamConstructorNode> {
  return createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    await new Promise<SerovalNode[]>(parseStreamHandle.bind(ctx, depth, id, current)),
  );
}

/**
 * Collects an async iterable into a replay node, one value at a time.
 */
async function parseAsyncIterable(
  ctx: AsyncParserContext,
  depth: number,
  current: AsyncIterable<unknown>,
): Promise<SerovalStreamConstructorNode> {
  const id = createIndexForValue(ctx.base, {});
  const reference = parseSpecialReference(ctx.base, SpecialReference.StreamConstructor);
  const iterator = current[SYM_ASYNC_ITERATOR]();
  const sequence: SerovalNode[] = [];
  for (;;) {
    let result: IteratorResult<unknown>;
    try {
      result = await iterator.next();
    } catch (error) {
      markParserRef(ctx.base, id);
      sequence.push(
        createStreamEventNode(SerovalNodeType.StreamThrow, id, await parseAsync(ctx, depth, error)),
      );
      break;
    }
    markParserRef(ctx.base, id);
    let parsed: SerovalNode;
    try {
      parsed = await parseAsync(ctx, depth, result.value);
    } catch (error) {
      Promise.resolve()
        .then(() => iterator.return?.())
        .catch(() => {
          // no-op
        });
      throw error;
    }
    sequence.push(
      createStreamEventNode(
        result.done ? SerovalNodeType.StreamReturn : SerovalNodeType.StreamNext,
        id,
        parsed,
      ),
    );
    if (result.done) {
      break;
    }
  }
  return createStreamConstructorNode(id, reference, sequence);
}

async function parseSequence(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Sequence,
): Promise<SerovalSequenceNode> {
  const len = current.v.length;
  const nodes = new Array<SerovalNode>(len);
  for (let i = 0, node: MaybeAsyncNode; i < len; i++) {
    node = parseValueAsync(ctx, depth, current.v[i]);
    nodes[i] = node instanceof Promise ? await node : node;
  }
  return createSequenceNode(id, nodes, current.t, current.d);
}

export async function parseObjectAsync(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: object,
): Promise<SerovalNode> {
  if (Array.isArray(current)) {
    return parseArray(ctx, depth, id, current);
  }
  if (isStream(current)) {
    return parseStream(ctx, depth, id, current);
  }
  if (isSequence(current)) {
    return parseSequence(ctx, depth, id, current);
  }
  const currentClass = getObjectClass(current);
  if (currentClass === OpaqueReference) {
    return parseAsync(ctx, depth, (current as OpaqueReference<unknown, unknown>).replacement);
  }
  const parsed = await parsePlugin(
    ctx,
    depth,
    id,
    current,
    currentClass === Object ? ctx.base.plainObjectPlugins : ctx.base.plugins,
  );
  if (parsed) {
    return parsed;
  }
  // Plain objects dominate real payloads; skip the classifier for them.
  if (currentClass === Object) {
    return parsePlainObject(ctx, depth, id, current as Record<string, unknown>, false);
  }
  switch (getObjectKind(current, currentClass, ctx.base.features)) {
    case ObjectKind.NullObject:
      return parsePlainObject(ctx, depth, id, current as Record<string, unknown>, true);
    case ObjectKind.Date:
      return createDateNode(id, current as unknown as Date);
    case ObjectKind.Error:
      return parseError(ctx, depth, SerovalNodeType.Error, id, current as unknown as Error);
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
      return createArrayBufferNode(ctx.base, id, current as unknown as ArrayBuffer);
    case ObjectKind.TypedArray:
      return parseView(
        ctx,
        depth,
        SerovalNodeType.TypedArray,
        id,
        current as unknown as TypedArrayValue,
      );
    case ObjectKind.BigIntTypedArray:
      return parseView(
        ctx,
        depth,
        SerovalNodeType.BigIntTypedArray,
        id,
        current as unknown as BigIntTypedArrayValue,
      );
    case ObjectKind.DataView:
      return parseView(ctx, depth, SerovalNodeType.DataView, id, current as unknown as DataView);
    case ObjectKind.Map:
      return parseMap(ctx, depth, id, current as unknown as Map<unknown, unknown>);
    case ObjectKind.Set:
      return parseSet(ctx, depth, id, current as unknown as Set<unknown>);
    case ObjectKind.Promise:
      return parsePromise(ctx, depth, id, current as unknown as Promise<unknown>);
    case ObjectKind.RegExp:
      return createRegExpNode(id, current as unknown as RegExp);
    case ObjectKind.Temporal:
      return createTemporalNode(
        id,
        getTemporalType(currentClass)!,
        current as unknown as Temporal.Instant,
      );
    case ObjectKind.Iterable:
      // Generator objects have no global constructor despite existing
      return parsePlainObject(ctx, depth, id, current as Record<string, unknown>, !!currentClass);
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

export async function parseFunctionAsync(
  ctx: AsyncParserContext,
  depth: number,
  current: unknown,
): Promise<SerovalNode> {
  const ref = getReferenceNode(ctx.base, current);
  if (typeof ref !== 'number') {
    return ref;
  }
  const plugin = await parsePlugin(ctx, depth, ref, current, ctx.base.plugins);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

/**
 * Parses primitives and already-seen values synchronously; only objects and
 * functions come back as a Promise. Errors are thrown synchronously, which
 * an async caller turns into a rejection as before.
 */
function parseValueAsync(ctx: AsyncParserContext, depth: number, current: unknown): MaybeAsyncNode {
  if (depth >= ctx.base.depthLimit) {
    throw new SerovalDepthLimitError(ctx.base.depthLimit);
  }
  switch (typeof current) {
    case 'boolean':
      return current ? TRUE_NODE : FALSE_NODE;
    case 'undefined':
      return UNDEFINED_NODE;
    case 'string':
      return createStringNode(current);
    case 'number':
      return createNumberNode(current);
    case 'bigint':
      return createBigIntNode(current);
    case 'object': {
      if (current) {
        const ref = getReferenceNode(ctx.base, current);
        return typeof ref === 'number' ? parseObjectAsync(ctx, depth + 1, ref, current) : ref;
      }
      return NULL_NODE;
    }
    case 'symbol':
      return parseWellKnownSymbol(ctx.base, current);
    case 'function':
      return parseFunctionAsync(ctx, depth, current);
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

export async function parseAsync(
  ctx: AsyncParserContext,
  depth: number,
  current: unknown,
): Promise<SerovalNode> {
  return await parseValueAsync(ctx, depth, current);
}

export async function parseTopAsync(
  ctx: AsyncParserContext,
  current: unknown,
): Promise<SerovalNode> {
  try {
    return await parseAsync(ctx, 0, current);
  } catch (error) {
    throw error instanceof SerovalParserError ? error : new SerovalParserError(error);
  }
}
