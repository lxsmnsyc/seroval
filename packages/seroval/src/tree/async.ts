/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import { createIndexedValue, getRootID, ParserContext } from '../context';
import { serializeString } from '../string';
import {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../types';
import {
  createBigIntNode,
  createBigIntTypedArrayNode,
  createDateNode,
  createNumberNode,
  createIndexedValueNode,
  createRegExpNode,
  createStringNode,
  createTypedArrayNode,
  createWKSymbolNode,
  FALSE_NODE,
  INFINITY_NODE,
  NAN_NODE,
  NEG_INFINITY_NODE,
  NEG_ZERO_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
  createReferenceNode,
} from './primitives';
import { hasReferenceID } from './reference';
import {
  getErrorConstructorName,
  getErrorOptions,
  getIterableOptions,
  isIterable,
} from './shared';
import { WellKnownSymbols } from './symbols';
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
import { createURLNode, createURLSearchParamsNode } from './web-api';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalIterableNode
  | SerovalPromiseNode;

type ObjectLikeValue =
  | Record<string, unknown>
  | Iterable<unknown>
  | PromiseLike<unknown>;

async function generateNodeList(
  ctx: ParserContext,
  current: unknown[],
) {
  const size = current.length;
  const nodes = new Array<SerovalNode>(size);
  const deferred = new Array<unknown>(size);
  let item: unknown;
  for (let i = 0; i < size; i++) {
    if (i in current) {
      item = current[i];
      if (isIterable(item)) {
        deferred[i] = item;
      } else {
        nodes[i] = await parse(ctx, item);
      }
    }
  }
  for (let i = 0; i < size; i++) {
    if (i in deferred) {
      nodes[i] = await parse(ctx, deferred[i]);
    }
  }
  return nodes;
}

async function generateArrayNode(
  ctx: ParserContext,
  id: number,
  current: unknown[],
): Promise<SerovalArrayNode> {
  return {
    t: SerovalNodeType.Array,
    i: id,
    s: undefined,
    l: current.length,
    c: undefined,
    m: undefined,
    d: undefined,
    a: await generateNodeList(ctx, current),
    f: undefined,
  };
}

async function generateMapNode(
  ctx: ParserContext,
  id: number,
  current: Map<unknown, unknown>,
): Promise<SerovalMapNode> {
  assert(ctx.features & Feature.Map, 'Unsupported type "Map"');
  const len = current.size;
  const keyNodes = new Array<SerovalNode>(len);
  const valueNodes = new Array<SerovalNode>(len);
  const deferredKey = new Array<unknown>(len);
  const deferredValue = new Array<unknown>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const [key, value] of current.entries()) {
    // Either key or value might be an iterable
    if (isIterable(key) || isIterable(value)) {
      deferredKey[deferredSize] = key;
      deferredValue[deferredSize] = value;
      deferredSize++;
    } else {
      keyNodes[nodeSize] = await parse(ctx, key);
      valueNodes[nodeSize] = await parse(ctx, value);
      nodeSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodeSize + i] = await parse(ctx, deferredKey[i]);
    valueNodes[nodeSize + i] = await parse(ctx, deferredValue[i]);
  }
  return {
    t: SerovalNodeType.Map,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    d: { k: keyNodes, v: valueNodes, s: len },
    a: undefined,
    f: undefined,
  };
}

async function generateSetNode(
  ctx: ParserContext,
  id: number,
  current: Set<unknown>,
): Promise<SerovalSetNode> {
  assert(ctx.features & Feature.Set, 'Unsupported type "Set"');
  const len = current.size;
  const nodes = new Array<SerovalNode>(len);
  const deferred = new Array<unknown>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const item of current.keys()) {
    // Iterables are lazy, so the evaluation must be deferred
    if (isIterable(item)) {
      deferred[deferredSize++] = item;
    } else {
      nodes[nodeSize++] = await parse(ctx, item);
    }
  }
  // Parse deferred items
  for (let i = 0; i < deferredSize; i++) {
    nodes[nodeSize + i] = await parse(ctx, deferred[i]);
  }
  return {
    t: SerovalNodeType.Set,
    i: id,
    s: undefined,
    l: len,
    c: undefined,
    m: undefined,
    d: undefined,
    a: nodes,
    f: undefined,
  };
}

async function generateProperties(
  ctx: ParserContext,
  properties: Record<string, unknown>,
): Promise<SerovalObjectRecordNode> {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<unknown>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: unknown;
  for (const key of keys) {
    item = properties[key];
    if (isIterable(item)) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = await parse(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = await parse(ctx, deferredValues[i]);
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

async function generateIterableNode(
  ctx: ParserContext,
  id: number,
  current: Iterable<unknown>,
): Promise<SerovalIterableNode> {
  assert(ctx.features & Feature.Symbol, 'Unsupported type "Iterable"');
  const options = getIterableOptions(current);
  const array = Array.from(current);
  return {
    t: SerovalNodeType.Iterable,
    i: id,
    s: undefined,
    l: array.length,
    c: undefined,
    m: undefined,
    // Parse options first before the items
    d: options
      ? await generateProperties(ctx, options)
      : undefined,
    a: await generateNodeList(ctx, array),
    f: undefined,
  };
}

async function generatePromiseNode(
  ctx: ParserContext,
  id: number,
  current: PromiseLike<unknown>,
): Promise<SerovalPromiseNode> {
  assert(ctx.features & Feature.Promise, 'Unsupported type "Promise"');
  return current.then(async (value) => ({
    t: SerovalNodeType.Promise,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    // Parse options first before the items
    d: undefined,
    a: undefined,
    f: await parse(ctx, value),
  }));
}

async function generateObjectNode(
  ctx: ParserContext,
  id: number,
  current: ObjectLikeValue,
  empty: boolean,
): Promise<ObjectLikeNode> {
  if (Symbol.iterator in current) {
    return generateIterableNode(ctx, id, current);
  }
  if ('then' in current && typeof current.then === 'function') {
    return generatePromiseNode(ctx, id, current as PromiseLike<unknown>);
  }
  return {
    t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    d: await generateProperties(ctx, current as Record<string, unknown>),
    a: undefined,
    f: undefined,
  };
}

async function generateAggregateErrorNode(
  ctx: ParserContext,
  id: number,
  current: AggregateError,
): Promise<SerovalAggregateErrorNode> {
  const options = getErrorOptions(ctx, current);
  const optionsNode = options
    ? await generateProperties(ctx, options)
    : undefined;
  return {
    t: SerovalNodeType.AggregateError,
    i: id,
    s: undefined,
    l: current.errors.length,
    c: undefined,
    m: serializeString(current.message),
    d: optionsNode,
    a: await generateNodeList(ctx, current.errors as unknown[]),
    f: undefined,
  };
}

async function generateErrorNode(
  ctx: ParserContext,
  id: number,
  current: Error,
): Promise<SerovalErrorNode> {
  const options = getErrorOptions(ctx, current);
  const optionsNode = options
    ? await generateProperties(ctx, options)
    : undefined;
  return {
    t: SerovalNodeType.Error,
    i: id,
    s: undefined,
    l: undefined,
    c: getErrorConstructorName(current),
    m: serializeString(current.message),
    d: optionsNode,
    a: undefined,
    f: undefined,
  };
}

async function parse<T>(
  ctx: ParserContext,
  current: T,
): Promise<SerovalNode> {
  switch (typeof current) {
    case 'boolean':
      return current ? TRUE_NODE : FALSE_NODE;
    case 'undefined':
      return UNDEFINED_NODE;
    case 'string':
      return createStringNode(current);
    case 'number':
      switch (current) {
        case Infinity: return INFINITY_NODE;
        case -Infinity: return NEG_INFINITY_NODE;
        default:
          // eslint-disable-next-line no-self-compare
          if (current !== current) {
            return NAN_NODE;
          }
          if (Object.is(current, -0)) {
            return NEG_ZERO_NODE;
          }
          return createNumberNode(current);
      }
    case 'bigint':
      return createBigIntNode(ctx, current);
    case 'object': {
      if (!current) {
        return NULL_NODE;
      }
      // Non-primitive values needs a reference ID
      // mostly because the values themselves are stateful
      const id = createIndexedValue(ctx, current);
      if (ctx.markedRefs.has(id)) {
        return createIndexedValueNode(id);
      }
      if (hasReferenceID(current)) {
        return createReferenceNode(id, current);
      }
      if (Array.isArray(current)) {
        return generateArrayNode(ctx, id, current);
      }
      switch (current.constructor) {
        case Date:
          return createDateNode(id, current as unknown as Date);
        case RegExp:
          return createRegExpNode(id, current as unknown as RegExp);
        case Promise:
          return generatePromiseNode(ctx, id, current as unknown as Promise<unknown>);
        case Int8Array:
        case Int16Array:
        case Int32Array:
        case Uint8Array:
        case Uint16Array:
        case Uint32Array:
        case Uint8ClampedArray:
        case Float32Array:
        case Float64Array:
          return createTypedArrayNode(ctx, id, current as unknown as TypedArrayValue);
        case BigInt64Array:
        case BigUint64Array:
          return createBigIntTypedArrayNode(ctx, id, current as unknown as BigIntTypedArrayValue);
        case Map:
          return generateMapNode(
            ctx,
            id,
            current as unknown as Map<unknown, unknown>,
          );
        case Set:
          return generateSetNode(
            ctx,
            id,
            current as unknown as Set<unknown>,
          );
        case Object:
          return generateObjectNode(
            ctx,
            id,
            current as Record<string, unknown>,
            false,
          );
        case undefined:
          return generateObjectNode(
            ctx,
            id,
            current as Record<string, unknown>,
            true,
          );
        case AggregateError:
          if (ctx.features & Feature.AggregateError) {
            return generateAggregateErrorNode(ctx, id, current as unknown as AggregateError);
          }
          return generateErrorNode(ctx, id, current as unknown as AggregateError);
        case Error:
        case EvalError:
        case RangeError:
        case ReferenceError:
        case SyntaxError:
        case TypeError:
        case URIError:
          return generateErrorNode(ctx, id, current as unknown as Error);
        case URL:
          return createURLNode(ctx, id, current as unknown as URL);
        case URLSearchParams:
          return createURLSearchParamsNode(ctx, id, current as unknown as URLSearchParams);
        default:
          break;
      }
      if (current instanceof AggregateError) {
        if (ctx.features & Feature.AggregateError) {
          return generateAggregateErrorNode(ctx, id, current);
        }
        return generateErrorNode(ctx, id, current);
      }
      if (current instanceof Error) {
        return generateErrorNode(ctx, id, current);
      }
      if (current instanceof Promise) {
        return generatePromiseNode(ctx, id, current);
      }
      // Generator functions don't have a global constructor
      if (Symbol.iterator in current) {
        return generateIterableNode(ctx, id, current as Iterable<unknown>);
      }
      // For Promise-like objects
      if ('then' in current && typeof current.then === 'function') {
        return generatePromiseNode(ctx, id, current as PromiseLike<unknown>);
      }
      throw new Error('Unsupported type');
    }
    case 'symbol':
      if (hasReferenceID(current)) {
        const id = createIndexedValue(ctx, current);
        if (ctx.markedRefs.has(id)) {
          return createIndexedValueNode(id);
        }
        return createReferenceNode(id, current);
      }
      return createWKSymbolNode(ctx, current as WellKnownSymbols);
    case 'function': {
      assert(hasReferenceID(current), 'Cannot serialize function without reference ID.');
      const id = createIndexedValue(ctx, current);
      if (ctx.markedRefs.has(id)) {
        return createIndexedValueNode(id);
      }
      return createReferenceNode(id, current);
    }
    default:
      throw new Error('Unsupported type');
  }
}

export default async function parseAsync<T>(
  ctx: ParserContext,
  current: T,
) {
  const result = await parse(ctx, current);
  const isObject = result.t === SerovalNodeType.Object
    || result.t === SerovalNodeType.Iterable;
  return [result, getRootID(ctx, current), isObject] as const;
}
