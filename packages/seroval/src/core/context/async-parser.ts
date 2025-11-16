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
import type { SerovalMode } from '../plugin';
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
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseNode,
  SerovalSetNode,
  SerovalStreamConstructorNode,
  SerovalTypedArrayNode,
} from '../types';
import { getErrorOptions } from '../utils/error';
import { iteratorToSequence } from '../utils/iterator-to-sequence';
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
  getReferenceNode,
  markParserRef,
  parseAsyncIteratorFactory,
  parseIteratorFactory,
  ParserNodeType,
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
  constructor(private _p: AsyncParserContext) {}

  parse<T>(current: T): Promise<SerovalNode> {
    return parseAsync(this._p, current);
  }
}

async function parseItems(
  ctx: AsyncParserContext,
  current: unknown[],
): Promise<SerovalNode[]> {
  const nodes = [];
  for (let i = 0, len = current.length; i < len; i++) {
    // For consistency in holes
    if (i in current) {
      nodes[i] = await parseAsync(ctx, current[i]);
    }
  }
  return nodes;
}

async function parseArray(
  ctx: AsyncParserContext,
  id: number,
  current: unknown[],
): Promise<SerovalArrayNode> {
  return createArrayNode(id, current, await parseItems(ctx, current));
}

async function parseProperties(
  ctx: AsyncParserContext,
  properties: Record<string | symbol, unknown>,
): Promise<SerovalObjectRecordNode> {
  const entries = Object.entries(properties);
  const keyNodes: SerovalObjectRecordKey[] = [];
  const valueNodes: SerovalNode[] = [];
  for (let i = 0, len = entries.length; i < len; i++) {
    keyNodes.push(serializeString(entries[i][0]));
    valueNodes.push(await parseAsync(ctx, entries[i][1]));
  }
  // Check special properties
  if (SYM_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ITERATOR));
    valueNodes.push(
      createIteratorFactoryInstanceNode(
        parseIteratorFactory(ctx.base),
        await parseAsync(
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
        await parseAsync(
          ctx,
          createStreamFromAsyncIterable(
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

async function parsePlainObject(
  ctx: AsyncParserContext,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): Promise<ObjectLikeNode> {
  return createObjectNode(
    id,
    current,
    empty,
    await parseProperties(ctx, current),
  );
}

// TODO: check if parseBoxedSync can be used
async function parseBoxed(
  ctx: AsyncParserContext,
  id: number,
  current: object,
): Promise<SerovalBoxedNode> {
  return createBoxedNode(id, await parseAsync(ctx, current.valueOf()));
}

async function parseTypedArray(
  ctx: AsyncParserContext,
  id: number,
  current: TypedArrayValue,
): Promise<SerovalTypedArrayNode> {
  return createTypedArrayNode(
    id,
    current,
    await parseAsync(ctx, current.buffer),
  );
}

async function parseBigIntTypedArray(
  ctx: AsyncParserContext,
  id: number,
  current: BigIntTypedArrayValue,
): Promise<SerovalBigIntTypedArrayNode> {
  return createBigIntTypedArrayNode(
    id,
    current,
    await parseAsync(ctx, current.buffer),
  );
}

async function parseDataView(
  ctx: AsyncParserContext,
  id: number,
  current: DataView,
): Promise<SerovalDataViewNode> {
  return createDataViewNode(id, current, await parseAsync(ctx, current.buffer));
}

async function parseError(
  ctx: AsyncParserContext,
  id: number,
  current: Error,
): Promise<SerovalErrorNode> {
  const options = getErrorOptions(current, ctx.base.features);
  return createErrorNode(
    id,
    current,
    options ? await parseProperties(ctx, options) : NIL,
  );
}

async function parseAggregateError(
  ctx: AsyncParserContext,
  id: number,
  current: AggregateError,
): Promise<SerovalAggregateErrorNode> {
  const options = getErrorOptions(current, ctx.base.features);
  return createAggregateErrorNode(
    id,
    current,
    options ? await parseProperties(ctx, options) : NIL,
  );
}

async function parseMap(
  ctx: AsyncParserContext,
  id: number,
  current: Map<unknown, unknown>,
): Promise<SerovalMapNode> {
  const keyNodes: SerovalNode[] = [];
  const valueNodes: SerovalNode[] = [];
  for (const [key, value] of current.entries()) {
    keyNodes.push(await parseAsync(ctx, key));
    valueNodes.push(await parseAsync(ctx, value));
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes, current.size);
}

async function parseSet(
  ctx: AsyncParserContext,
  id: number,
  current: Set<unknown>,
): Promise<SerovalSetNode> {
  const items: SerovalNode[] = [];
  for (const item of current.keys()) {
    items.push(await parseAsync(ctx, item));
  }
  return createSetNode(id, current.size, items);
}

async function parsePlugin(
  ctx: AsyncParserContext,
  id: number,
  current: unknown,
): Promise<SerovalPluginNode | undefined> {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) {
    for (let i = 0, len = currentPlugins.length; i < len; i++) {
      const plugin = currentPlugins[i];
      if (plugin.parse.async && plugin.test(current)) {
        if (ctx.child == null) {
          ctx.child = new AsyncParsePluginContext(ctx);
        }
        return createPluginNode(
          id,
          plugin.tag,
          await plugin.parse.async(current, ctx.child, {
            id,
          }),
        );
      }
    }
  }
  return NIL;
}

async function parsePromise(
  ctx: AsyncParserContext,
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
    NIL,
    await parseAsync(ctx, result),
    NIL,
    NIL,
  );
}

function parseStreamHandle<T>(
  this: AsyncParserContext,
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
      parseAsync(this, value).then(
        data => {
          sequence.push(createStreamNextNode(id, data));
        },
        data => {
          reject(data);
          cleanup();
        },
      );
    },
    throw: value => {
      markParserRef(this.base, id);
      parseAsync(this, value).then(
        data => {
          sequence.push(createStreamThrowNode(id, data));
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
      parseAsync(this, value).then(
        data => {
          sequence.push(createStreamReturnNode(id, data));
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
  id: number,
  current: Stream<unknown>,
): Promise<SerovalStreamConstructorNode> {
  return createStreamConstructorNode(
    id,
    parseSpecialReference(ctx.base, SpecialReference.StreamConstructor),
    await new Promise<SerovalNode[]>(parseStreamHandle.bind(ctx, id, current)),
  );
}

export async function parseObjectAsync(
  ctx: AsyncParserContext,
  id: number,
  current: object,
): Promise<SerovalNode> {
  if (Array.isArray(current)) {
    return parseArray(ctx, id, current);
  }
  if (isStream(current)) {
    return parseStream(ctx, id, current);
  }
  const currentClass = current.constructor;
  if (currentClass === OpaqueReference) {
    return parseAsync(
      ctx,
      (current as OpaqueReference<unknown, unknown>).replacement,
    );
  }
  const parsed = await parsePlugin(ctx, id, current);
  if (parsed) {
    return parsed;
  }
  switch (currentClass) {
    case Object:
      return parsePlainObject(
        ctx,
        id,
        current as Record<string, unknown>,
        false,
      );
    case NIL:
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

export async function parseFunctionAsync(
  ctx: AsyncParserContext,
  current: unknown,
): Promise<SerovalNode> {
  const ref = getReferenceNode(ctx.base, current);
  if (ref.type !== ParserNodeType.Fresh) {
    return ref.value;
  }
  const plugin = await parsePlugin(ctx, ref.value, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

export async function parseAsync<T>(
  ctx: AsyncParserContext,
  current: T,
): Promise<SerovalNode> {
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
        return ref.type === 0
          ? await parseObjectAsync(ctx, ref.value, current as object)
          : ref.value;
      }
      return NULL_NODE;
    }
    case 'symbol':
      return parseWellKnownSymbol(ctx.base, current);
    case 'function':
      return parseFunctionAsync(ctx, current);
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

export async function parseTopAsync<T>(
  ctx: AsyncParserContext,
  current: T,
): Promise<SerovalNode> {
  try {
    return await parseAsync(ctx, current);
  } catch (error) {
    throw error instanceof SerovalParserError
      ? error
      : new SerovalParserError(error);
  }
}
