/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import type { StreamingCrossParserContext } from './context';
import {
  createCrossIndexedValue, popPendingState, pushPendingState,
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
  SerovalPromiseConstructorNode,
  SerovalSetNode,
  SerovalReadableStreamConstructorNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
// import {
//   createBlobNode,
//   createFileNode,
// } from './web-api';
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

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode;

function generateNodeList(
  ctx: StreamingCrossParserContext,
  current: unknown[],
): SerovalNode[] {
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
        nodes[i] = crossParseStream(ctx, item);
      }
    }
  }
  for (let i = 0; i < size; i++) {
    if (i in deferred) {
      nodes[i] = crossParseStream(ctx, deferred[i]);
    }
  }
  return nodes;
}

function generateArrayNode(
  ctx: StreamingCrossParserContext,
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
  ctx: StreamingCrossParserContext,
  id: number,
  current: Map<unknown, unknown>,
): SerovalMapNode {
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
      keyNodes[nodeSize] = crossParseStream(ctx, key);
      valueNodes[nodeSize] = crossParseStream(ctx, value);
      nodeSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodeSize + i] = crossParseStream(ctx, deferredKey[i]);
    valueNodes[nodeSize + i] = crossParseStream(ctx, deferredValue[i]);
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
  ctx: StreamingCrossParserContext,
  id: number,
  current: Set<unknown>,
): SerovalSetNode {
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
      nodes[nodeSize++] = crossParseStream(ctx, item);
    }
  }
  // Parse deferred items
  for (let i = 0; i < deferredSize; i++) {
    nodes[nodeSize + i] = crossParseStream(ctx, deferred[i]);
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
  ctx: StreamingCrossParserContext,
  properties: Record<string, unknown>,
): SerovalObjectRecordNode {
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
      valueNodes[nodesSize] = crossParseStream(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = crossParseStream(ctx, deferredValues[i]);
  }
  if (ctx.features & Feature.Symbol) {
    if (Symbol.iterator in properties) {
      keyNodes[size] = SerovalObjectRecordSpecialKey.SymbolIterator;
      const items = Array.from(properties as Iterable<unknown>);
      valueNodes[size] = generateArrayNode(
        ctx,
        createCrossIndexedValue(ctx, items),
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

function generatePlainProperties(
  ctx: StreamingCrossParserContext,
  properties: Record<string, unknown>,
): SerovalPlainRecordNode {
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
      valueNodes[nodesSize] = crossParseStream(ctx, item);
      nodesSize++;
    }
  }
  for (let i = 0; i < deferredSize; i++) {
    keyNodes[nodesSize + i] = deferredKeys[i];
    valueNodes[nodesSize + i] = crossParseStream(ctx, deferredValues[i]);
  }
  return {
    k: keyNodes,
    v: valueNodes,
    s: size,
  };
}

function generatePromiseNode(
  ctx: StreamingCrossParserContext,
  id: number,
  current: Promise<unknown>,
): SerovalPromiseConstructorNode {
  assert(ctx.features & Feature.Promise, new UnsupportedTypeError(current));
  current.then(
    (data) => {
      if (ctx.alive) {
        ctx.onParse({
          t: SerovalNodeType.PromiseResolve,
          i: id,
          s: undefined,
          l: undefined,
          c: undefined,
          m: undefined,
          p: undefined,
          e: undefined,
          a: undefined,
          f: crossParseStream(ctx, data),
          b: undefined,
          o: undefined,
        }, false);
        popPendingState(ctx);
      }
    },
    (data) => {
      if (ctx.alive) {
        ctx.onParse({
          t: SerovalNodeType.PromiseReject,
          i: id,
          s: undefined,
          l: undefined,
          c: undefined,
          m: undefined,
          p: undefined,
          e: undefined,
          a: undefined,
          f: crossParseStream(ctx, data),
          b: undefined,
          o: undefined,
        }, false);
        popPendingState(ctx);
      }
    },
  );
  pushPendingState(ctx);
  return {
    t: SerovalNodeType.PromiseConstructor,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

function generateObjectNode(
  ctx: StreamingCrossParserContext,
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
  ctx: StreamingCrossParserContext,
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
  ctx: StreamingCrossParserContext,
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
  ctx: StreamingCrossParserContext,
  id: number,
  current: Headers,
): SerovalHeadersNode {
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
    e: generatePlainProperties(ctx, items),
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

function generateFormDataNode(
  ctx: StreamingCrossParserContext,
  id: number,
  current: FormData,
): SerovalFormDataNode {
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
    e: generatePlainProperties(ctx, items),
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

function generateBoxedNode(
  ctx: StreamingCrossParserContext,
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
    f: crossParseStream(ctx, current.valueOf()),
    b: undefined,
    o: undefined,
  };
}

function generateReadableStreamNode(
  ctx: StreamingCrossParserContext,
  id: number,
  current: ReadableStream<unknown>,
): SerovalReadableStreamConstructorNode {
  assert(ctx.features & Feature.WebAPI, new UnsupportedTypeError(current));
  const reader = current.getReader();
  pushPendingState(ctx);

  function push(): void {
    reader.read().then(
      (data) => {
        if (ctx.alive) {
          if (data.done) {
            ctx.onParse({
              t: SerovalNodeType.ReadableStreamClose,
              i: id,
              s: undefined,
              l: undefined,
              c: undefined,
              m: undefined,
              p: undefined,
              e: undefined,
              a: undefined,
              f: undefined,
              b: undefined,
              o: undefined,
            }, false);
            popPendingState(ctx);
          } else {
            ctx.onParse({
              t: SerovalNodeType.ReadableStreamEnqueue,
              i: id,
              s: undefined,
              l: undefined,
              c: undefined,
              m: undefined,
              p: undefined,
              e: undefined,
              a: undefined,
              f: crossParseStream(ctx, data.value),
              b: undefined,
              o: undefined,
            }, false);
            push();
          }
        }
      },
      (value) => {
        if (ctx.alive) {
          ctx.onParse({
            t: SerovalNodeType.ReadableStreamError,
            i: id,
            s: undefined,
            l: undefined,
            c: undefined,
            m: undefined,
            p: undefined,
            e: undefined,
            a: undefined,
            f: crossParseStream(ctx, value),
            b: undefined,
            o: undefined,
          }, false);
          popPendingState(ctx);
        }
      },
    );
  }

  push();

  return {
    t: SerovalNodeType.ReadableStreamConstructor,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

function parseObject(
  ctx: StreamingCrossParserContext,
  current: object | null,
): SerovalNode {
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
    // case Blob:
    //   return createBlobNode(ctx, id, current as unknown as Blob);
    // case File:
    //   return createFileNode(ctx, id, current as unknown as File);
    case Headers:
      return generateHeadersNode(ctx, id, current as unknown as Headers);
    case FormData:
      return generateFormDataNode(ctx, id, current as unknown as FormData);
    case ReadableStream:
      return generateReadableStreamNode(ctx, id, current as unknown as ReadableStream);
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

export default function crossParseStream<T>(
  ctx: StreamingCrossParserContext,
  current: T,
): SerovalNode {
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
