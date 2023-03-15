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
  SerovalDictionaryNode,
  SerovalErrorNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeType,
  SerovalSetNode,
} from './types';

async function generateDictionary(
  ctx: ParserContext,
  properties: Record<string, AsyncServerValue>,
): Promise<SerovalDictionaryNode> {
  const keys = Object.keys(properties);
  const nodes: SerovalDictionaryNode = {};
  const deferred: Record<string, AsyncServerValue> = {};
  for (const key of keys) {
    if (isIterable(properties[key])) {
      deferred[key] = properties[key];
    } else {
      nodes[key] = await generateTreeAsync(ctx, properties[key]);
    }
  }
  for (const key of Object.keys(deferred)) {
    nodes[key] = await generateTreeAsync(ctx, deferred[key]);
  }
  return nodes;
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
  return [SerovalNodeType.Set, nodes, id];
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
  return [SerovalNodeType.Map, [keyNodes, valueNodes, len], id];
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
  return [SerovalNodeType.Array, await generateNodeList(ctx, current), id];
}

async function generateAggregateErrorNode(
  ctx: ParserContext,
  current: AggregateError,
  id: number,
): Promise<SerovalAggregateErrorNode> {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? await generateDictionary(ctx, options)
    : undefined;
  const errorsNode = await generateTreeAsync(ctx, current.errors as AsyncServerValue);
  return [
    SerovalNodeType.AggregateError,
    [current.message, optionsNode, errorsNode],
    id,
  ];
}

async function generateErrorNode(
  ctx: ParserContext,
  current: Error,
  id: number,
): Promise<SerovalErrorNode> {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? await generateDictionary(ctx, options)
    : undefined;
  return [
    SerovalNodeType.Error,
    [getErrorConstructor(current), current.message, optionsNode],
    id,
  ];
}

async function generateIterableNode(
  ctx: ParserContext,
  current: Iterable<AsyncServerValue>,
  id: number,
): Promise<SerovalIterableNode> {
  assert(ctx.features & Feature.SymbolIterator, 'Unsupported type "Iterable"');
  const options = getIterableOptions(current);
  return [SerovalNodeType.Iterable, [
    // Parse options first before the items
    options
      ? await generateDictionary(ctx, options as Record<string, AsyncServerValue>)
      : undefined,
    await generateNodeList(ctx, Array.from(current)),
  ], id];
}

async function generateTreeAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
): Promise<SerovalNode> {
  if (isPrimitive(current)) {
    return [SerovalNodeType.Primitive, serializePrimitive(current)];
  }
  // Non-primitive values needs a reference ID
  // mostly because the values themselves are stateful
  const id = generateRef(ctx, current);
  if (Array.isArray(id)) {
    return id;
  }
  const semiPrimitive = generateSemiPrimitiveValue(ctx, current, id);
  if (semiPrimitive) {
    return semiPrimitive;
  }
  if (isPromise(current)) {
    assert(ctx.features & Feature.Promise, 'Unsupported type "Promise"');
    return current.then(async (value) => [
      SerovalNodeType.Promise,
      await generateTreeAsync(ctx, value),
      id,
    ]);
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
    return [
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      await generateDictionary(ctx, current as Record<string, AsyncServerValue>),
      id,
    ];
  }
  throw new Error('Unsupported value');
}

export default async function parseAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
) {
  const result = await generateTreeAsync(ctx, current);
  return [result, createRef(ctx, current), result[0] === SerovalNodeType.Object] as const;
}
