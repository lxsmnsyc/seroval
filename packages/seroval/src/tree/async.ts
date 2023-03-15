/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import {
  isIterable,
  isPrimitive,
  constructorCheck,
  isPromise,
} from '../checks';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import { AsyncServerValue } from '../types';
import {
  generateRef,
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

async function serializePropertiesAsync(
  ctx: ParserContext,
  properties: Record<string, unknown>,
): Promise<SerovalObjectRecordNode> {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<AsyncServerValue>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  for (const key of keys) {
    if (isIterable(properties[key])) {
      deferredKeys[deferredSize] = key;
      deferredValues[deferredSize] = properties[key] as AsyncServerValue;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = key;
      valueNodes[nodesSize] = await generateTreeAsync(ctx, properties[key] as AsyncServerValue);
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
  for (let i = 0; i < size; i++) {
    if (i in current) {
      if (isIterable(current[i])) {
        deferred[i] = current[i];
      } else {
        nodes[i] = await generateTreeAsync(ctx, current[i]);
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
    d: options ? await serializePropertiesAsync(ctx, options) : undefined,
    a: await generateNodeList(ctx, Array.from(current)),
    n: undefined,
  };
}

async function generateTreeAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
): Promise<SerovalNode> {
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
  // Non-primitive values needs a reference ID
  // mostly because the values themselves are stateful
  const id = generateRef(ctx, current);
  if (typeof id !== 'number') {
    return id;
  }
  const semiPrimitive = generateSemiPrimitiveValue(ctx, current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (isPromise(current)) {
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
  if (constructorCheck<Set<AsyncServerValue>>(current, Set)) {
    return generateSetNode(ctx, current, id);
  }
  if (constructorCheck<Map<AsyncServerValue, AsyncServerValue>>(current, Map)) {
    return generateMapNode(ctx, current, id);
  }
  if (Array.isArray(current)) {
    return generateArrayNode(ctx, current, id);
  }
  if (current instanceof AggregateError && ctx.features & Feature.AggregateError) {
    return generateAggregateErrorNode(ctx, current, id);
  }
  if (current instanceof Error) {
    return generateErrorNode(ctx, current, id);
  }
  if (isIterable(current)) {
    return generateIterableNode(ctx, current, id);
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    return {
      t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      i: id,
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      // Parse options first before the items
      d: await serializePropertiesAsync(ctx, current as Record<string, unknown>),
      a: undefined,
      n: undefined,
    };
  }
  throw new Error('Unsupported value');
}

export default async function parseAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
) {
  const result = await generateTreeAsync(ctx, current);
  return [result, createRef(ctx, current), result.t === SerovalNodeType.Object] as const;
}
