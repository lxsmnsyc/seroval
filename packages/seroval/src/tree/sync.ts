/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import quote from '../quote';
import { BigIntTypedArrayValue, ServerValue, TypedArrayValue } from '../types';
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
  SerovalSetNode,
} from './types';

function serializePropertiesSync(
  ctx: ParserContext,
  properties: Record<string, ServerValue>,
): SerovalObjectRecordNode {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<ServerValue>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: ServerValue;
  for (const key of keys) {
    item = properties[key];
    if (isIterable(item)) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = generateTreeSync(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = generateTreeSync(ctx, deferredValues[i]);
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

function generateSetNode(
  ctx: ParserContext,
  current: Set<ServerValue>,
  id: number,
): SerovalSetNode {
  assert(ctx.features & Feature.Set, 'Unsupported type "Set"');
  const len = current.size;
  const nodes = new Array<SerovalNode>(len);
  const deferred = new Array<ServerValue>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const item of current.keys()) {
    // Iterables are lazy, so the evaluation must be deferred
    if (isIterable(item)) {
      deferred[deferredSize++] = item;
    } else {
      nodes[nodeSize++] = generateTreeSync(ctx, item);
    }
  }
  // Parse deferred items
  for (let i = 0; i < deferredSize; i++) {
    nodes[nodeSize + i] = generateTreeSync(ctx, deferred[i]);
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

function generateMapNode(
  ctx: ParserContext,
  current: Map<ServerValue, ServerValue>,
  id: number,
): SerovalMapNode {
  assert(ctx.features & Feature.Map, 'Unsupported type "Map"');
  const len = current.size;
  const keyNodes = new Array<SerovalNode>(len);
  const valueNodes = new Array<SerovalNode>(len);
  const deferredKey = new Array<ServerValue>(len);
  const deferredValue = new Array<ServerValue>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const [key, value] of current.entries()) {
    // Either key or value might be an iterable
    if (isIterable(key) || isIterable(value)) {
      deferredKey[deferredSize] = key;
      deferredValue[deferredSize] = value;
      deferredSize++;
    } else {
      keyNodes[nodeSize] = generateTreeSync(ctx, key);
      valueNodes[nodeSize] = generateTreeSync(ctx, value);
      nodeSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodeSize + i] = generateTreeSync(ctx, deferredKey[i]);
    valueNodes[nodeSize + i] = generateTreeSync(ctx, deferredValue[i]);
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

function generateNodeList(
  ctx: ParserContext,
  current: ServerValue[],
) {
  const size = current.length;
  const nodes = new Array<SerovalNode>(size);
  const deferred = new Array<ServerValue>(size);
  let item: ServerValue;
  for (let i = 0; i < size; i++) {
    if (i in current) {
      item = current[i];
      if (isIterable(item)) {
        deferred[i] = item;
      } else {
        nodes[i] = generateTreeSync(ctx, item);
      }
    }
  }
  for (let i = 0; i < size; i++) {
    if (i in deferred) {
      nodes[i] = generateTreeSync(ctx, deferred[i]);
    }
  }
  return nodes;
}

function generateArrayNode(
  ctx: ParserContext,
  current: ServerValue[],
  id: number,
): SerovalArrayNode {
  return {
    t: SerovalNodeType.Array,
    i: id,
    a: generateNodeList(ctx, current),
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    d: undefined,
    n: undefined,
  };
}

function generateAggregateErrorNode(
  ctx: ParserContext,
  current: AggregateError,
  id: number,
): SerovalAggregateErrorNode {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? serializePropertiesSync(ctx, options)
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
    n: generateTreeSync(ctx, current.errors as ServerValue),
  };
}

function generateErrorNode(
  ctx: ParserContext,
  current: Error,
  id: number,
): SerovalErrorNode {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? serializePropertiesSync(ctx, options)
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

function generateIterableNode(
  ctx: ParserContext,
  current: Iterable<ServerValue>,
  id: number,
): SerovalIterableNode {
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
      ? serializePropertiesSync(ctx, options as Record<string, ServerValue>)
      : undefined,
    a: generateNodeList(ctx, Array.from(current)),
    n: undefined,
  };
}

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode | SerovalIterableNode;

function generateObjectNode(
  ctx: ParserContext,
  current: Record<string, ServerValue> | Iterable<ServerValue>,
  id: number,
  empty: boolean,
): ObjectLikeNode {
  if (Symbol.iterator in current) {
    return generateIterableNode(ctx, current, id);
  }
  return {
    t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    i: id,
    s: undefined,
    l: undefined,
    m: undefined,
    c: undefined,
    d: serializePropertiesSync(ctx, current),
    a: undefined,
    n: undefined,
  };
}

function generateTreeSync(
  ctx: ParserContext,
  current: ServerValue,
): SerovalNode {
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
        case Map:
          return generateMapNode(ctx, current as Map<ServerValue, ServerValue>, id);
        case Set:
          return generateSetNode(ctx, current as Set<ServerValue>, id);
        case Object:
          return generateObjectNode(ctx, current as Record<string, ServerValue>, id, false);
        case undefined:
          return generateObjectNode(ctx, current as Record<string, ServerValue>, id, true);
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
      // Generator functions don't have a global constructor
      if (Symbol.iterator in current) {
        return generateIterableNode(ctx, current, id);
      }
      throw new Error('Unsupported type');
    }
    default:
      throw new Error('Unsupported type');
  }
}

export default function parseSync(
  ctx: ParserContext,
  current: ServerValue,
) {
  const result = generateTreeSync(ctx, current);
  const isObject = result.t === SerovalNodeType.Object
    || result.t === SerovalNodeType.Iterable;
  return [result, createRef(ctx, current, false), isObject] as const;
}
