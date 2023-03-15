/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import quote from '../quote';
import {
  AsyncServerValue,
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../types';
import {
  createBigIntNode,
  createBigIntTypedArrayNode,
  createDateNode,
  createPrimitiveNode,
  createReferenceNode,
  createRegExpNode,
  createTypedArrayNode,
  FALSE_NODE,
  NEG_ZERO_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from './primitives';
import {
  getErrorConstructor,
  getErrorOptions,
  getIterableOptions,
  isIterable,
} from './shared';
import {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalErrorNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeType,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalSetNode,
} from './types';

async function serializePropertiesAsync(
  ctx: ParserContext,
  properties: Record<string, AsyncServerValue>,
): Promise<SerovalObjectRecordNode> {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<AsyncServerValue>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: AsyncServerValue;
  for (const key of keys) {
    item = properties[key];
    if (isIterable(item)) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = await generateTreeAsync(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = await generateTreeAsync(ctx, deferredValues[i]);
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

async function generateSetNode(
  ctx: ParserContext,
  current: Set<AsyncServerValue>,
  id: number,
): Promise<SerovalSetNode> {
  assert(ctx.features & Feature.Set, 'Unsupported type "Set"');
  const len = current.size;
  const nodes = new Array<SerovalNode>(len);
  const deferred = new Array<AsyncServerValue>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const item of current.keys()) {
    // Iterables are lazy, so the evaluation must be deferred
    if (isIterable(item)) {
      deferred[deferredSize++] = item;
    } else {
      nodes[nodeSize++] = await generateTreeAsync(ctx, item);
    }
  }
  // Parse deferred items
  for (let i = 0; i < deferredSize; i++) {
    nodes[nodeSize + i] = await generateTreeAsync(ctx, deferred[i]);
  }
  return {
    t: SerovalNodeType.Set,
    i: id,
    a: nodes,
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    d: undefined,
    n: undefined,
  };
}

async function generateMapNode(
  ctx: ParserContext,
  current: Map<AsyncServerValue, AsyncServerValue>,
  id: number,
): Promise<SerovalMapNode> {
  assert(ctx.features & Feature.Map, 'Unsupported type "Map"');
  const len = current.size;
  const keyNodes = new Array<SerovalNode>(len);
  const valueNodes = new Array<SerovalNode>(len);
  const deferredKey = new Array<AsyncServerValue>(len);
  const deferredValue = new Array<AsyncServerValue>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const [key, value] of current.entries()) {
    // Either key or value might be an iterable
    if (isIterable(key) || isIterable(value)) {
      deferredKey[deferredSize] = key;
      deferredValue[deferredSize] = value;
      deferredSize++;
    } else {
      keyNodes[nodeSize] = await generateTreeAsync(ctx, key);
      valueNodes[nodeSize] = await generateTreeAsync(ctx, value);
      nodeSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodeSize + i] = await generateTreeAsync(ctx, deferredKey[i]);
    valueNodes[nodeSize + i] = await generateTreeAsync(ctx, deferredValue[i]);
  }
  return {
    t: SerovalNodeType.Map,
    i: id,
    a: undefined,
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    d: { k: keyNodes, v: valueNodes, s: len },
    n: undefined,
  };
}

async function generateNodeList(
  ctx: ParserContext,
  current: AsyncServerValue[],
) {
  const size = current.length;
  const nodes = new Array<SerovalNode>(size);
  const deferred = new Array<AsyncServerValue>(size);
  let item: AsyncServerValue;
  for (let i = 0; i < size; i++) {
    if (i in current) {
      item = current[i];
      if (isIterable(item)) {
        deferred[i] = item;
      } else {
        nodes[i] = await generateTreeAsync(ctx, item);
      }
    }
  }
  for (let i = 0; i < size; i++) {
    if (i in deferred) {
      nodes[i] = await generateTreeAsync(ctx, deferred[i]);
    }
  }
  return nodes;
}

async function generateArrayNode(
  ctx: ParserContext,
  current: AsyncServerValue[],
  id: number,
): Promise<SerovalArrayNode> {
  return {
    t: SerovalNodeType.Array,
    i: id,
    a: await generateNodeList(ctx, current),
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    d: undefined,
    n: undefined,
  };
}

async function generateAggregateErrorNode(
  ctx: ParserContext,
  current: AggregateError,
  id: number,
): Promise<SerovalAggregateErrorNode> {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? await serializePropertiesAsync(ctx, options)
    : undefined;
  return {
    t: SerovalNodeType.AggregateError,
    i: id,
    a: undefined,
    s: undefined,
    l: undefined,
    m: current.message,
    c: undefined,
    d: optionsNode,
    n: await generateTreeAsync(ctx, current.errors as AsyncServerValue),
  };
}

async function generateErrorNode(
  ctx: ParserContext,
  current: Error,
  id: number,
): Promise<SerovalErrorNode> {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? await serializePropertiesAsync(ctx, options)
    : undefined;
  return {
    t: SerovalNodeType.Error,
    i: id,
    a: undefined,
    s: undefined,
    l: undefined,
    m: current.message,
    c: getErrorConstructor(current),
    d: optionsNode,
    n: undefined,
  };
}

async function generateIterableNode(
  ctx: ParserContext,
  current: Iterable<AsyncServerValue>,
  id: number,
): Promise<SerovalIterableNode> {
  assert(ctx.features & Feature.SymbolIterator, 'Unsupported type "Iterable"');
  const options = getIterableOptions(current);
  return {
    t: SerovalNodeType.Iterable,
    i: id,
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    // Parse options first before the items
    d: options
      ? await serializePropertiesAsync(ctx, options as Record<string, AsyncServerValue>)
      : undefined,
    a: await generateNodeList(ctx, Array.from(current)),
    n: undefined,
  };
}

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalIterableNode
  | SerovalPromiseNode;

type ObjectLikeValue =
  | Record<string, AsyncServerValue>
  | Iterable<AsyncServerValue>
  | PromiseLike<AsyncServerValue>;

async function generateObjectNode(
  ctx: ParserContext,
  current: ObjectLikeValue,
  id: number,
  empty: boolean,
): Promise<ObjectLikeNode> {
  if (Symbol.iterator in current) {
    return generateIterableNode(ctx, current, id);
  }
  if ('then' in current && typeof current.then === 'function') {
    return generatePromiseNode(ctx, current as PromiseLike<AsyncServerValue>, id);
  }
  return {
    t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    i: id,
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    d: await serializePropertiesAsync(ctx, current as Record<string, AsyncServerValue>),
    a: undefined,
    n: undefined,
  };
}

async function generatePromiseNode(
  ctx: ParserContext,
  current: PromiseLike<AsyncServerValue>,
  id: number,
): Promise<SerovalPromiseNode> {
  assert(ctx.features & Feature.Promise, 'Unsupported type "Promise"');
  return current.then(async (value) => ({
    t: SerovalNodeType.Promise,
    i: id,
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    // Parse options first before the items
    d: undefined,
    a: undefined,
    n: await generateTreeAsync(ctx, value),
  }));
}

async function generateTreeAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
): Promise<SerovalNode> {
  switch (typeof current) {
    case 'boolean':
      return current ? TRUE_NODE : FALSE_NODE;
    case 'undefined':
      return UNDEFINED_NODE;
    case 'string':
      return createPrimitiveNode(quote(current));
    case 'number':
      if (Object.is(current, -0)) {
        return NEG_ZERO_NODE;
      }
      if (Object.is(current, Infinity)) {
        return createPrimitiveNode('1/0');
      }
      if (Object.is(current, -Infinity)) {
        return createPrimitiveNode('-1/0');
      }
      return createPrimitiveNode(current);
    case 'bigint':
      return createBigIntNode(ctx, current);
    case 'object': {
      if (!current) {
        return NULL_NODE;
      }
      // Non-primitive values needs a reference ID
      // mostly because the values themselves are stateful
      const id = createRef(ctx, current, true);
      if (ctx.markedRefs[id]) {
        return createReferenceNode(id);
      }
      if (Array.isArray(current)) {
        return generateArrayNode(ctx, current, id);
      }
      switch (current.constructor) {
        case Date:
          return createDateNode(id, current as Date);
        case RegExp:
          return createRegExpNode(id, current as RegExp);
        case Promise:
          return generatePromiseNode(ctx, current as Promise<AsyncServerValue>, id);
        case Map:
          return generateMapNode(ctx, current as Map<AsyncServerValue, AsyncServerValue>, id);
        case Set:
          return generateSetNode(ctx, current as Set<AsyncServerValue>, id);
        case Object:
          return generateObjectNode(ctx, current as Record<string, AsyncServerValue>, id, false);
        case undefined:
          return generateObjectNode(ctx, current as Record<string, AsyncServerValue>, id, true);
        case Int8Array:
        case Int16Array:
        case Int32Array:
        case Uint8Array:
        case Uint16Array:
        case Uint32Array:
        case Uint8ClampedArray:
        case Float32Array:
        case Float64Array:
          return createTypedArrayNode(ctx, id, current as TypedArrayValue);
        case BigInt64Array:
        case BigUint64Array:
          return createBigIntTypedArrayNode(ctx, id, current as BigIntTypedArrayValue);
        case AggregateError:
          if (ctx.features & Feature.AggregateError) {
            return generateAggregateErrorNode(ctx, current as AggregateError, id);
          }
          return generateErrorNode(ctx, current as AggregateError, id);
        case Error:
        case EvalError:
        case RangeError:
        case ReferenceError:
        case SyntaxError:
        case TypeError:
        case URIError:
          return generateErrorNode(ctx, current as Error, id);
        default:
          break;
      }
      if (current instanceof AggregateError && ctx.features & Feature.AggregateError) {
        return generateAggregateErrorNode(ctx, current, id);
      }
      if (current instanceof Error) {
        return generateErrorNode(ctx, current, id);
      }
      if (current instanceof Promise) {
        return generatePromiseNode(ctx, current as PromiseLike<AsyncServerValue>, id);
      }
      // Generator functions don't have a global constructor
      if (Symbol.iterator in current) {
        return generateIterableNode(ctx, current, id);
      }
      // For Promise-like objects
      if ('then' in current && typeof current.then === 'function') {
        return generatePromiseNode(ctx, current as PromiseLike<AsyncServerValue>, id);
      }
      throw new Error('Unsupported type');
    }
    default:
      throw new Error('Unsupported type');
  }
}

export default async function parseAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
) {
  const result = await generateTreeAsync(ctx, current);
  const isObject = result.t === SerovalNodeType.Object
    || result.t === SerovalNodeType.Iterable;
  return [result, createRef(ctx, current, false), isObject] as const;
}
