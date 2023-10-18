/* eslint-disable @typescript-eslint/no-use-before-define */
import { BIGINT_FLAG, Feature } from '../compat';
import { createCrossIndexedValue, type CrossParserContext } from './context';
import { serializeString } from '../string';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
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
import {
  hasReferenceID,
} from '../reference';
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
  SerovalCustomEventNode,
  SerovalErrorNode,
  SerovalEventNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalMapNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPlainRecordNode,
  SerovalSetNode,
  SerovalSyncNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
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
import { createDOMExceptionNode, createURLNode, createURLSearchParamsNode } from '../web-api';
import { createCustomEventOptions, createEventOptions } from '../constructors';

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode;

function generateNodeList(ctx: CrossParserContext, current: unknown[]): SerovalSyncNode[] {
  const size = current.length;
  const nodes = new Array<SerovalSyncNode>(size);
  const deferred = new Array<unknown>(size);
  let item: unknown;
  for (let i = 0; i < size; i++) {
    if (i in current) {
      item = current[i];
      if (isIterable(ctx, item)) {
        deferred[i] = item;
      } else {
        nodes[i] = crossParseSync(ctx, item);
      }
    }
  }
  for (let i = 0; i < size; i++) {
    if (i in deferred) {
      nodes[i] = crossParseSync(ctx, deferred[i]);
    }
  }
  return nodes;
}

function generateArrayNode(
  ctx: CrossParserContext,
  id: number,
  current: unknown[],
): SerovalArrayNode {
  return {
    t: SerovalNodeType.Array,
    i: id,
    s: undefined,
    l: current.length,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: generateNodeList(ctx, current),
    f: undefined,
    b: undefined,
    o: getObjectFlag(current),
  };
}

function generateMapNode(
  ctx: CrossParserContext,
  id: number,
  current: Map<unknown, unknown>,
): SerovalMapNode {
  const len = current.size;
  const keyNodes = new Array<SerovalSyncNode>(len);
  const valueNodes = new Array<SerovalSyncNode>(len);
  const deferredKey = new Array<unknown>(len);
  const deferredValue = new Array<unknown>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const [key, value] of current.entries()) {
    // Either key or value might be an iterable
    if (isIterable(ctx, key) || isIterable(ctx, value)) {
      deferredKey[deferredSize] = key;
      deferredValue[deferredSize] = value;
      deferredSize++;
    } else {
      keyNodes[nodeSize] = crossParseSync(ctx, key);
      valueNodes[nodeSize] = crossParseSync(ctx, value);
      nodeSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodeSize + i] = crossParseSync(ctx, deferredKey[i]);
    valueNodes[nodeSize + i] = crossParseSync(ctx, deferredValue[i]);
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

function generateSetNode(
  ctx: CrossParserContext,
  id: number,
  current: Set<unknown>,
): SerovalSetNode {
  const len = current.size;
  const nodes = new Array<SerovalSyncNode>(len);
  const deferred = new Array<unknown>(len);
  let deferredSize = 0;
  let nodeSize = 0;
  for (const item of current.keys()) {
    // Iterables are lazy, so the evaluation must be deferred
    if (isIterable(ctx, item)) {
      deferred[deferredSize++] = item;
    } else {
      nodes[nodeSize++] = crossParseSync(ctx, item);
    }
  }
  // Parse deferred items
  for (let i = 0; i < deferredSize; i++) {
    nodes[nodeSize + i] = crossParseSync(ctx, deferred[i]);
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

function generateProperties(
  ctx: CrossParserContext,
  properties: Record<string, unknown>,
): SerovalObjectRecordNode {
  const keys = Object.keys(properties);
  let size = keys.length;
  const keyNodes = new Array<SerovalObjectRecordKey>(size);
  const valueNodes = new Array<SerovalSyncNode>(size);
  const deferredKeys = new Array<SerovalObjectRecordKey>(size);
  const deferredValues = new Array<unknown>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: unknown;
  let escaped: SerovalObjectRecordKey;
  for (const key of keys) {
    item = properties[key];
    escaped = serializeString(key);
    if (isIterable(ctx, item)) {
      deferredKeys[deferredSize] = escaped;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = escaped;
      valueNodes[nodesSize] = crossParseSync(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = crossParseSync(ctx, deferredValues[i]);
  }
  if (ctx.features & Feature.Symbol) {
    if (Symbol.iterator in properties) {
      keyNodes[size] = SerovalObjectRecordSpecialKey.SymbolIterator;
      const items = Array.from(properties as Iterable<unknown>);
      valueNodes[size] = generateArrayNode(ctx, createCrossIndexedValue(ctx, items), items);
      size++;
    }
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

function generatePlainProperties(
  ctx: CrossParserContext,
  properties: Record<string, unknown>,
): SerovalPlainRecordNode {
  const keys = Object.keys(properties);
  const size = keys.length;
  const keyNodes = new Array<string>(size);
  const valueNodes = new Array<SerovalSyncNode>(size);
  const deferredKeys = new Array<string>(size);
  const deferredValues = new Array<unknown>(size);
  let deferredSize = 0;
  let nodesSize = 0;
  let item: unknown;
  let escaped: string;
  for (const key of keys) {
    item = properties[key];
    escaped = serializeString(key);
    if (isIterable(ctx, item)) {
      deferredKeys[deferredSize] = escaped;
      deferredValues[deferredSize] = item;
      deferredSize++;
    } else {
      keyNodes[nodesSize] = escaped;
      valueNodes[nodesSize] = crossParseSync(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = crossParseSync(ctx, deferredValues[i]);
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

function generateObjectNode(
  ctx: CrossParserContext,
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
): ObjectLikeNode {
  return {
    t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: generateProperties(ctx, current),
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: getObjectFlag(current),
  };
}

function generateAggregateErrorNode(
  ctx: CrossParserContext,
  id: number,
  current: AggregateError,
): SerovalAggregateErrorNode {
  const options = getErrorOptions(ctx, current);
  const optionsNode = options
    ? generateProperties(ctx, options)
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

function generateErrorNode(
  ctx: CrossParserContext,
  id: number,
  current: Error,
): SerovalErrorNode {
  const options = getErrorOptions(ctx, current);
  const optionsNode = options
    ? generateProperties(ctx, options)
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

function generateHeadersNode(
  ctx: CrossParserContext,
  id: number,
  current: Headers,
): SerovalHeadersNode {
  const items: Record<string, string> = {};
  // TS Headers not an Iterable
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
    e: generatePlainProperties(ctx, items),
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

function generateFormDataNode(
  ctx: CrossParserContext,
  id: number,
  current: FormData,
): SerovalFormDataNode {
  const items: Record<string, FormDataEntryValue> = {};
  // TS FormData isn't an Iterable sadly
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
    e: generatePlainProperties(ctx, items),
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

function generateBoxedNode(
  ctx: CrossParserContext,
  id: number,
  current: object,
): SerovalBoxedNode {
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
    f: crossParseSync(ctx, current.valueOf()),
    b: undefined,
    o: undefined,
  };
}

function generateEventNode(ctx: CrossParserContext, id: number, current: Event): SerovalEventNode {
  return {
    t: SerovalNodeType.Event,
    i: id,
    s: serializeString(current.type),
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: parseObject(ctx, createEventOptions(current)),
    b: undefined,
    o: undefined,
  };
}

function generateCustomEventNode(
  ctx: CrossParserContext,
  id: number,
  current: CustomEvent,
): SerovalCustomEventNode {
  return {
    t: SerovalNodeType.CustomEvent,
    i: id,
    s: serializeString(current.type),
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: parseObject(ctx, createCustomEventOptions(current)),
    b: undefined,
    o: undefined,
  };
}

function parseObject(
  ctx: CrossParserContext,
  current: object | null,
): SerovalSyncNode {
  if (!current) {
    return NULL_NODE;
  }
  // Non-primitive values needs a reference ID
  // mostly because the values themselves are stateful
  const registeredID = ctx.refs.get(current);
  if (registeredID != null) {
    return createIndexedValueNode(registeredID);
  }
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  if (hasReferenceID(current)) {
    return createReferenceNode(id, current);
  }
  // Well well well
  if (Array.isArray(current)) {
    return generateArrayNode(ctx, id, current);
  }
  const currentClass = current.constructor;
  // Fast path
  switch (currentClass) {
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return generateBoxedNode(ctx, id, current);
    case Date:
      return createDateNode(id, current as unknown as Date);
    case RegExp:
      return createRegExpNode(id, current as unknown as RegExp);
    case Object:
      return generateObjectNode(
        ctx,
        id,
        current as unknown as Record<string, unknown>,
        false,
      );
    case undefined:
      return generateObjectNode(
        ctx,
        id,
        current as unknown as Record<string, unknown>,
        true,
      );
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return generateErrorNode(ctx, id, current as unknown as Error);
    default:
      break;
  }
  // Typed Arrays
  if (ctx.features & Feature.TypedArray) {
    switch (currentClass) {
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
      case DataView:
        return createDataViewNode(ctx, id, current as unknown as DataView);
      default:
        break;
    }
  }
  // BigInt Typed Arrays
  if ((ctx.features & BIGINT_FLAG) === BIGINT_FLAG) {
    switch (currentClass) {
      case BigInt64Array:
      case BigUint64Array:
        return createBigIntTypedArrayNode(ctx, id, current as unknown as BigIntTypedArrayValue);
      default:
        break;
    }
  }
  // ES Collection
  if (ctx.features & Feature.Map && currentClass === Map) {
    return generateMapNode(ctx, id, current as unknown as Map<unknown, unknown>);
  }
  if (ctx.features & Feature.Set && currentClass === Set) {
    return generateSetNode(ctx, id, current as unknown as Set<unknown>);
  }
  // Web APIs
  if (ctx.features & Feature.WebAPI) {
    if (typeof URL !== 'undefined' && currentClass === URL) {
      return createURLNode(id, current as unknown as URL);
    }
    if (typeof URLSearchParams !== 'undefined' && currentClass === URLSearchParams) {
      return createURLSearchParamsNode(id, current as unknown as URLSearchParams);
    }
    if (typeof Headers !== 'undefined' && currentClass === Headers) {
      return generateHeadersNode(ctx, id, current as unknown as Headers);
    }
    if (typeof FormData !== 'undefined' && currentClass === FormData) {
      return generateFormDataNode(ctx, id, current as unknown as FormData);
    }
    if (typeof Event !== 'undefined' && currentClass === Event) {
      return generateEventNode(ctx, id, current as unknown as Event);
    }
    if (typeof CustomEvent !== 'undefined' && currentClass === CustomEvent) {
      return generateCustomEventNode(ctx, id, current as unknown as CustomEvent);
    }
    if (typeof DOMException !== 'undefined' && currentClass === DOMException) {
      return createDOMExceptionNode(id, current as unknown as DOMException);
    }
  }
  if (
    (ctx.features & Feature.AggregateError)
    && typeof AggregateError !== 'undefined'
    && (currentClass === AggregateError || current instanceof AggregateError)
  ) {
    return generateAggregateErrorNode(ctx, id, current as unknown as AggregateError);
  }
  // Slow path. We only need to handle Errors and Iterators
  // since they have very broad implementations.
  if (current instanceof Error) {
    return generateErrorNode(ctx, id, current);
  }
  // Generator functions don't have a global constructor
  // despite existing
  if (ctx.features & Feature.Symbol && Symbol.iterator in current) {
    return generateObjectNode(ctx, id, current, !!currentClass);
  }
  throw new UnsupportedTypeError(current);
}

export default function crossParseSync<T>(
  ctx: CrossParserContext,
  current: T,
): SerovalSyncNode {
  const t = typeof current;
  if (ctx.features & Feature.BigInt && t === 'bigint') {
    return createBigIntNode(current as bigint);
  }
  switch (t) {
    case 'boolean':
      return current ? TRUE_NODE : FALSE_NODE;
    case 'undefined':
      return UNDEFINED_NODE;
    case 'string':
      return createStringNode(current as string);
    case 'number':
      return createNumberNode(current as number);
    case 'object':
      return parseObject(ctx, current as object);
    case 'symbol':
      return createSymbolNode(ctx, current as symbol);
    case 'function':
      // eslint-disable-next-line @typescript-eslint/ban-types
      return createFunctionNode(ctx, current as Function);
    default:
      throw new UnsupportedTypeError(current);
  }
}
