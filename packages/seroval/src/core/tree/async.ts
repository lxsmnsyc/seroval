/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import type { ParserContext } from './context';
import {
  createIndexedValue,
} from './context';
import { serializeString } from '../string';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import {
  TRUE_NODE,
  FALSE_NODE,
  UNDEFINED_NODE,
  NULL_NODE,
} from '../literals';
import {
  createBigIntTypedArrayNode,
  createTypedArrayNode,
  createDataViewNode,
  createSymbolNode,
  createFunctionNode,
} from './primitives';
import { hasReferenceID } from '../reference';
import {
  getErrorConstructorName,
  getErrorOptions,
  getObjectFlag,
  isIterable,
} from '../shared';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBoxedNode,
  SerovalErrorNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPlainRecordNode,
  SerovalPromiseNode,
  SerovalSetNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
import {
  createBlobNode,
  createFileNode,
} from './web-api';
import { SerovalNodeType } from '../constants';
import {
  createArrayBufferNode,
  createBigIntNode,
  createDateNode,
  createIndexedValueNode,
  createNumberNode,
  createReferenceNode,
  createRegExpNode,
  createStringNode,
} from '../base-primitives';
import { createURLNode, createURLSearchParamsNode } from '../web-api';
import promiseToResult from '../promise-to-result';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode;

async function generateNodeList(
  ctx: ParserContext,
  current: unknown[],
): Promise<SerovalNode[]> {
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
        nodes[i] = await parseAsync(ctx, item);
      }
    }
  }
  for (let i = 0; i < size; i++) {
    if (i in deferred) {
      nodes[i] = await parseAsync(ctx, deferred[i]);
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
    p: undefined,
    e: undefined,
    a: await generateNodeList(ctx, current),
    f: undefined,
    b: undefined,
    o: getObjectFlag(current),
  };
}

async function generateMapNode(
  ctx: ParserContext,
  id: number,
  current: Map<unknown, unknown>,
): Promise<SerovalMapNode> {
  assert(ctx.features & Feature.Map, new UnsupportedTypeError(current));
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
      keyNodes[nodeSize] = await parseAsync(ctx, key);
      valueNodes[nodeSize] = await parseAsync(ctx, value);
      nodeSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodeSize + i] = await parseAsync(ctx, deferredKey[i]);
    valueNodes[nodeSize + i] = await parseAsync(ctx, deferredValue[i]);
  }
  return {
    t: SerovalNodeType.Map,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: { k: keyNodes, v: valueNodes, s: len },
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

async function generateSetNode(
  ctx: ParserContext,
  id: number,
  current: Set<unknown>,
): Promise<SerovalSetNode> {
  assert(ctx.features & Feature.Set, new UnsupportedTypeError(current));
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
      nodes[nodeSize++] = await parseAsync(ctx, item);
    }
  }
  // Parse deferred items
  for (let i = 0; i < deferredSize; i++) {
    nodes[nodeSize + i] = await parseAsync(ctx, deferred[i]);
  }
  return {
    t: SerovalNodeType.Set,
    i: id,
    s: undefined,
    l: len,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: nodes,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

async function generateProperties(
  ctx: ParserContext,
  properties: Record<string, unknown>,
): Promise<SerovalObjectRecordNode> {
  const keys = Object.keys(properties);
  let size = keys.length;
  const keyNodes = new Array<SerovalObjectRecordKey>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<SerovalObjectRecordKey>(size);
  const deferredValues = new Array<unknown>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: unknown;
  let escaped: SerovalObjectRecordKey;
  for (const key of keys) {
    item = properties[key];
    escaped = serializeString(key);
    if (isIterable(item)) {
      deferredKeys[deferredSize] = escaped;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = escaped;
      valueNodes[nodesSize] = await parseAsync(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = await parseAsync(ctx, deferredValues[i]);
  }
  if (ctx.features & Feature.Symbol) {
    if (Symbol.iterator in properties) {
      keyNodes[size] = SerovalObjectRecordSpecialKey.SymbolIterator;
      const items = Array.from(properties as Iterable<unknown>);
      valueNodes[size] = await generateArrayNode(
        ctx,
        createIndexedValue(ctx, items),
        items,
      );
      size++;
    }
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

async function generatePlainProperties(
  ctx: ParserContext,
  properties: Record<string, unknown>,
): Promise<SerovalPlainRecordNode> {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<unknown>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: unknown;
  let escaped: string;
  for (const key of keys) {
    item = properties[key];
    escaped = serializeString(key);
    if (isIterable(item)) {
      deferredKeys[deferredSize] = escaped;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = escaped;
      valueNodes[nodesSize] = await parseAsync(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = await parseAsync(ctx, deferredValues[i]);
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

async function generatePromiseNode(
  ctx: ParserContext,
  id: number,
  current: Promise<unknown>,
): Promise<SerovalPromiseNode> {
  assert(ctx.features & Feature.Promise, new UnsupportedTypeError(current));
  const [status, result] = await promiseToResult(current);
  return {
    t: SerovalNodeType.Promise,
    i: id,
    s: status,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: await parseAsync(ctx, result),
    b: undefined,
    o: undefined,
  };
}

async function generateObjectNode(
  ctx: ParserContext,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): Promise<ObjectLikeNode> {
  return {
    t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: await generateProperties(ctx, current),
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: getObjectFlag(current),
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
    l: undefined,
    c: undefined,
    m: serializeString(current.message),
    p: optionsNode,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
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
    p: optionsNode,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

async function generateHeadersNode(
  ctx: ParserContext,
  id: number,
  current: Headers,
): Promise<SerovalHeadersNode> {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  const items: Record<string, string> = {};
  current.forEach((value, key) => {
    items[key] = value;
  });
  return {
    t: SerovalNodeType.Headers,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: await generatePlainProperties(ctx, items),
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

async function generateFormDataNode(
  ctx: ParserContext,
  id: number,
  current: FormData,
): Promise<SerovalFormDataNode> {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  const items: Record<string, FormDataEntryValue> = {};
  current.forEach((value, key) => {
    items[key] = value;
  });
  return {
    t: SerovalNodeType.FormData,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: await generatePlainProperties(ctx, items),
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

async function generateBoxedNode(
  ctx: ParserContext,
  id: number,
  current: object,
): Promise<SerovalBoxedNode> {
  return {
    t: SerovalNodeType.Boxed,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: await parseAsync(ctx, current.valueOf()),
    b: undefined,
    o: undefined,
  };
}

async function parseObject(
  ctx: ParserContext,
  current: object | null,
): Promise<SerovalNode> {
  if (!current) {
    return NULL_NODE;
  }
  // Non-primitive values needs a reference ID
  // mostly because the values themselves are stateful
  const id = createIndexedValue(ctx, current);
  if (ctx.reference.marked.has(id)) {
    return createIndexedValueNode(id);
  }
  if (hasReferenceID(current)) {
    return createReferenceNode(id, current);
  }
  if (Array.isArray(current)) {
    return generateArrayNode(ctx, id, current);
  }
  switch (current.constructor) {
    case Number:
    case Boolean:
    case String:
    case BigInt:
    case Function:
    case Symbol:
      return generateBoxedNode(ctx, id, current);
    case Date:
      return createDateNode(id, current as unknown as Date);
    case RegExp:
      return createRegExpNode(id, current as unknown as RegExp);
    case Promise:
      return generatePromiseNode(ctx, id, current as unknown as Promise<unknown>);
    case ArrayBuffer:
      return createArrayBufferNode(id, current as unknown as ArrayBuffer);
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
    case DataView:
      return createDataViewNode(ctx, id, current as unknown as DataView);
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
    case Blob:
      return createBlobNode(ctx, id, current as unknown as Blob);
    case File:
      return createFileNode(ctx, id, current as unknown as File);
    case Headers:
      return generateHeadersNode(ctx, id, current as unknown as Headers);
    case FormData:
      return generateFormDataNode(ctx, id, current as unknown as FormData);
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
    return generateObjectNode(ctx, id, current, !!current.constructor);
  }
  throw new UnsupportedTypeError(current);
}

export default async function parseAsync<T>(
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
      return createNumberNode(current);
    case 'bigint':
      return createBigIntNode(ctx, current);
    case 'object':
      return parseObject(ctx, current);
    case 'symbol':
      return createSymbolNode(ctx, current);
    case 'function':
      return createFunctionNode(ctx, current);
    default:
      throw new UnsupportedTypeError(current);
  }
}
