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
  createStreamNode,
  createStringNode,
  createTemporalNode,
  createTypedArrayNode,
} from '../base-primitives';
import { NIL, SerovalNodeType } from '../constants';
import {
  SerovalDepthLimitError,
  SerovalParserError,
  SerovalUnsupportedTypeError,
} from '../errors';
import { FALSE_NODE, NULL_NODE, TRUE_NODE, UNDEFINED_NODE } from '../literals';
import { createSerovalNode } from '../node';
import { OpaqueReference } from '../opaque-reference';
import type { SerovalMode } from '../plugin';
import {
  createSequenceFromIterable,
  isSequence,
  type Sequence,
} from '../sequence';
import { SpecialReference } from '../special-reference';
import type { Stream } from '../stream';
import { createStreamFromAsyncIterable, isStream } from '../stream';
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
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../utils/typed-array';
import type { BaseParserContext, BaseParserContextOptions } from './parser';
import {
  createArrayBufferNode,
  createBaseParserContext,
  createMapNode,
  createObjectNode,
  getArrayBufferView,
  getObjectClass,
  getObjectKind,
  getReferenceNode,
  getTemporalType,
  markParserRef,
  ObjectKind,
  parseAsyncIteratorFactory,
  parseIteratorFactory,
  parseSpecialReference,
  parseWellKnownSymbol,
} from './parser';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode;

export type AsyncParserContextOptions = BaseParserContextOptions;

export interface AsyncParserContext {
  base: BaseParserContext;
  child: AsyncParsePluginContext | undefined;
}

export function createAsyncParserContext(
  mode: SerovalMode,
  options: AsyncParserContextOptions,
): AsyncParserContext {
  return {
    base: createBaseParserContext(mode, options),
    child: undefined,
  };
}

export class AsyncParsePluginContext {
  constructor(
    private _p: AsyncParserContext,
    private depth: number,
  ) {}

  parse<T>(current: T): Promise<SerovalNode> {
    return parseAsync(this._p, this.depth, current);
  }
}

async function parseItems(
  ctx: AsyncParserContext,
  depth: number,
  current: unknown[],
): Promise<(SerovalNode | 0)[]> {
  const nodes: (SerovalNode | 0)[] = [];
  for (let i = 0, len = current.length; i < len; i++) {
    // For consistency in holes
    if (i in current) {
      nodes[i] = await parseAsync(ctx, depth, current[i]);
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
  const keyNodes: SerovalObjectRecordKey[] = [];
  const valueNodes: SerovalNode[] = [];
  for (let i = 0, len = keys.length, key: string; i < len; i++) {
    key = keys[i];
    keyNodes.push(serializeString(key));
    valueNodes.push(await parseAsync(ctx, depth, properties[key]));
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
          createSequenceFromIterable(
            properties as unknown as Iterable<unknown>,
          ),
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
        (await parseAsync(
          ctx,
          depth,
          createStreamFromAsyncIterable(
            properties as unknown as AsyncIterable<unknown>,
          ),
        )) as SerovalNodeWithID,
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

async function parsePlainObject(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): Promise<ObjectLikeNode> {
  return createObjectNode(
    id,
    current,
    empty,
    await parseProperties(ctx, depth, current),
  );
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

async function parseTypedArray(
  ctx: AsyncParserContext,
  depth: number,
  type: SerovalNodeType.TypedArray | SerovalNodeType.BigIntTypedArray,
  id: number,
  current: TypedArrayValue | BigIntTypedArrayValue,
): Promise<SerovalTypedArrayNode | SerovalBigIntTypedArrayNode> {
  current = getArrayBufferView(ctx.base, current);
  return createTypedArrayNode(
    type,
    id,
    current,
    await parseAsync(ctx, depth, current.buffer),
  );
}

async function parseDataView(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: DataView,
): Promise<SerovalDataViewNode> {
  current = getArrayBufferView(ctx.base, current);
  return createDataViewNode(
    id,
    current,
    await parseAsync(ctx, depth, current.buffer),
  );
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
  const keyNodes: SerovalNode[] = [];
  const valueNodes: SerovalNode[] = [];
  for (const [key, value] of current.entries()) {
    keyNodes.push(await parseAsync(ctx, depth, key));
    valueNodes.push(await parseAsync(ctx, depth, value));
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes);
}

async function parseSet(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Set<unknown>,
): Promise<SerovalSetNode> {
  const items: SerovalNode[] = [];
  for (const item of current.keys()) {
    items.push(await parseAsync(ctx, depth, item));
  }
  return createSetNode(id, items);
}

async function parsePlugin(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: unknown,
): Promise<SerovalPluginNode | undefined> {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) {
    for (let i = 0, len = currentPlugins.length; i < len; i++) {
      const plugin = currentPlugins[i];
      if (plugin.parse.async && plugin.test(current)) {
        return createPluginNode(
          id,
          plugin.tag,
          await plugin.parse.async(
            current,
            new AsyncParsePluginContext(ctx, depth),
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
  current: Stream<T>,
  resolve: (value: SerovalNode[] | PromiseLike<SerovalNode[]>) => void,
  reject: (reason?: any) => void,
): void {
  const sequence: SerovalNode[] = [];
  // TODO Optimizable
  const cleanup = current.on({
    next: value => {
      markParserRef(this.base, id);
      parseAsync(this, depth, value).then(
        data => {
          sequence.push(createStreamNode(SerovalNodeType.StreamNext, id, data));
        },
        data => {
          reject(data);
          cleanup();
        },
      );
    },
    throw: value => {
      markParserRef(this.base, id);
      parseAsync(this, depth, value).then(
        data => {
          sequence.push(
            createStreamNode(SerovalNodeType.StreamThrow, id, data),
          );
          resolve(sequence);
          cleanup();
        },
        data => {
          reject(data);
          cleanup();
        },
      );
    },
    return: value => {
      markParserRef(this.base, id);
      parseAsync(this, depth, value).then(
        data => {
          sequence.push(
            createStreamNode(SerovalNodeType.StreamReturn, id, data),
          );
          resolve(sequence);
          cleanup();
        },
        data => {
          reject(data);
          cleanup();
        },
      );
    },
  });
}

async function parseStream(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Stream<unknown>,
): Promise<SerovalStreamConstructorNode> {
  return createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    await new Promise<SerovalNode[]>(
      parseStreamHandle.bind(ctx, depth, id, current),
    ),
  );
}

async function parseSequence(
  ctx: AsyncParserContext,
  depth: number,
  id: number,
  current: Sequence,
): Promise<SerovalSequenceNode> {
  const nodes: SerovalNode[] = [];
  for (let i = 0, len = current.v.length; i < len; i++) {
    nodes[i] = await parseAsync(ctx, depth, current.v[i]);
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
    return parseAsync(
      ctx,
      depth,
      (current as OpaqueReference<unknown, unknown>).replacement,
    );
  }
  const parsed = await parsePlugin(ctx, depth, id, current);
  if (parsed) {
    return parsed;
  }
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

export async function parseFunctionAsync(
  ctx: AsyncParserContext,
  depth: number,
  current: unknown,
): Promise<SerovalNode> {
  const ref = getReferenceNode(ctx.base, current);
  if (typeof ref !== 'number') {
    return ref;
  }
  const plugin = await parsePlugin(ctx, depth, ref, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

export async function parseAsync<T>(
  ctx: AsyncParserContext,
  depth: number,
  current: T,
): Promise<SerovalNode> {
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
          ? await parseObjectAsync(ctx, depth + 1, ref, current as object)
          : ref;
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

export async function parseTopAsync<T>(
  ctx: AsyncParserContext,
  current: T,
): Promise<SerovalNode> {
  try {
    return await parseAsync(ctx, 0, current);
  } catch (error) {
    throw error instanceof SerovalParserError
      ? error
      : new SerovalParserError(error);
  }
}
