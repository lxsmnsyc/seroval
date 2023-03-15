/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { isIterable, isPrimitive } from '../checks';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import { ServerValue } from '../types';
import {
  generateSemiPrimitiveValue,
  getErrorConstructor,
  getErrorOptions,
  getIterableOptions,
  serializePrimitive,
} from './shared';
import {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalErrorNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeType,
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
  for (const key of keys) {
    if (isIterable(properties[key])) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = properties[key];
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = generateTreeSync(ctx, properties[key]);
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
  for (let i = 0; i < size; i++) {
    if (i in current) {
      if (isIterable(current[i])) {
        deferred[i] = current[i];
      } else {
        nodes[i] = generateTreeSync(ctx, current[i]);
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

function generateTreeSync(
  ctx: ParserContext,
  current: ServerValue,
): SerovalNode {
  if (isPrimitive(current)) {
    return {
      t: SerovalNodeType.Primitive,
      i: undefined,
      s: serializePrimitive(current),
      l: undefined,
      m: undefined,
      c: undefined,
      // Parse options first before the items
      d: undefined,
      a: undefined,
      n: undefined,
    };
  }
  if (typeof current === 'bigint') {
    assert(ctx.features & Feature.BigInt, 'Unsupported type "BigInt"');
    return {
      t: SerovalNodeType.BigInt,
      i: undefined,
      a: undefined,
      s: `${current}n`,
      l: undefined,
      m: undefined,
      c: undefined,
      d: undefined,
      n: undefined,
    };
  }
  // Non-primitive values needs a reference ID
  // mostly because the values themselves are stateful
  const id = createRef(ctx, current, true);
  if (ctx.markedRefs[id]) {
    return {
      t: SerovalNodeType.Reference,
      i: id,
      a: undefined,
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      d: undefined,
      n: undefined,
    };
  }
  if (Array.isArray(current)) {
    return generateArrayNode(ctx, current, id);
  }
  const cs = current.constructor;
  const empty = cs == null;
  if (cs === Object || empty) {
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
      // Parse options first before the items
      d: serializePropertiesSync(ctx, current as Record<string, ServerValue>),
      a: undefined,
      n: undefined,
    };
  }
  if (cs === Set) {
    return generateSetNode(ctx, current as Set<ServerValue>, id);
  }
  if (cs === Map) {
    return generateMapNode(ctx, current as Map<ServerValue, ServerValue>, id);
  }
  const semiPrimitive = generateSemiPrimitiveValue(ctx, current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (Symbol.iterator in current) {
    return generateIterableNode(ctx, current, id);
  }
  if (current instanceof AggregateError && ctx.features & Feature.AggregateError) {
    return generateAggregateErrorNode(ctx, current, id);
  }
  if (current instanceof Error) {
    return generateErrorNode(ctx, current, id);
  }
  throw new Error('Unsupported value');
}

export default function parseSync(
  ctx: ParserContext,
  current: ServerValue,
) {
  const result = generateTreeSync(ctx, current);
  return [result, createRef(ctx, current, false), result.t === SerovalNodeType.Object] as const;
}
