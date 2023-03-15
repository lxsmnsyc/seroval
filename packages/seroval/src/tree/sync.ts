/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { isIterable, isPrimitive, constructorCheck } from '../checks';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import { ServerValue } from '../types';
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

function generateDictionary(
  ctx: ParserContext,
  properties: Record<string, ServerValue>,
): SerovalDictionaryNode {
  const keys = Object.keys(properties);
  const nodes: SerovalDictionaryNode = {};
  const deferred: Record<string, ServerValue> = {};
  for (const key of keys) {
    if (isIterable(properties[key])) {
      deferred[key] = properties[key];
    } else {
      nodes[key] = generateTreeSync(ctx, properties[key]);
    }
  }
  for (const key of Object.keys(deferred)) {
    nodes[key] = generateTreeSync(ctx, deferred[key]);
  }
  return nodes;
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
  return [SerovalNodeType.Set, nodes, id];
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
  return [SerovalNodeType.Map, [keyNodes, valueNodes, len], id];
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
  return [SerovalNodeType.Array, generateNodeList(ctx, current), id];
}

function generateAggregateErrorNode(
  ctx: ParserContext,
  current: AggregateError,
  id: number,
): SerovalAggregateErrorNode {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? generateDictionary(ctx, options)
    : undefined;
  const errorsNode = generateTreeSync(ctx, current.errors as ServerValue);
  return [SerovalNodeType.AggregateError, [current.message, optionsNode, errorsNode], id];
}

function generateErrorNode(
  ctx: ParserContext,
  current: Error,
  id: number,
): SerovalErrorNode {
  const options = getErrorOptions(current);
  const optionsNode = options
    ? generateDictionary(ctx, options)
    : undefined;
  return [
    SerovalNodeType.Error,
    [getErrorConstructor(current), current.message, optionsNode],
    id,
  ];
}

function generateIterableNode(
  ctx: ParserContext,
  current: Iterable<ServerValue>,
  id: number,
): SerovalIterableNode {
  assert(ctx.features & Feature.SymbolIterator, 'Unsupported type "Iterable"');
  const options = getIterableOptions(current);
  return [SerovalNodeType.Iterable, [
    // Parse options first before the items
    options
      ? generateDictionary(ctx, options as Record<string, ServerValue>)
      : undefined,
    generateNodeList(ctx, Array.from(current)),
  ], id];
}

function generateTreeSync(
  ctx: ParserContext,
  current: ServerValue,
): SerovalNode {
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
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    return generateSetNode(ctx, current, id);
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
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
      generateDictionary(ctx, current as Record<string, ServerValue>),
      id,
    ];
  }
  throw new Error('Unsupported value');
}

export default function parseSync(
  ctx: ParserContext,
  current: ServerValue,
) {
  const result = generateTreeSync(ctx, current);
  return [result, createRef(ctx, current), result[0] === SerovalNodeType.Object] as const;
}
