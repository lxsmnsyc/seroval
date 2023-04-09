/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  SerializationContext,
} from '../context';
import { deserializeString } from '../string';
import { AsyncServerValue } from '../types';
import { getReference } from './reference';
import { getErrorConstructor, getTypedArrayConstructor } from './shared';
import { SYMBOL_REF } from './symbols';
import {
  SerovalAggregateErrorNode,
  SerovalArrayBufferNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalBlobNode,
  SerovalDataViewNode,
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
  SerovalTypedArrayNode,
} from './types';

function assignIndexedValue<T>(
  ctx: SerializationContext,
  index: number,
  value: T,
) {
  ctx.valueMap.set(index, value);
  return value;
}

function deserializeNodeList(
  ctx: SerializationContext,
  node: SerovalArrayNode | SerovalIterableNode | SerovalAggregateErrorNode,
  result: unknown[],
) {
  let item: SerovalNode;
  for (let i = 0, len = node.a.length; i < len; i++) {
    item = node.a[i];
    if (item) {
      result[i] = deserializeTree(ctx, item);
    }
  }
  return result;
}

function deserializeArray(
  ctx: SerializationContext,
  node: SerovalArrayNode,
) {
  const result: AsyncServerValue[] = assignIndexedValue(
    ctx,
    node.i,
    new Array<AsyncServerValue>(node.l),
  );
  ctx.stack.push(node.i);
  deserializeNodeList(ctx, node, result);
  ctx.stack.pop();
  return result;
}

function deserializeProperties(
  ctx: SerializationContext,
  node: SerovalObjectRecordNode,
  result: Record<string, unknown>,
) {
  if (node.s === 0) {
    return {};
  }
  for (let i = 0; i < node.s; i++) {
    result[deserializeString(node.k[i])] = deserializeTree(ctx, node.v[i]);
  }
  return result;
}

function deserializeNullConstructor(
  ctx: SerializationContext,
  node: SerovalNullConstructorNode,
) {
  const result = assignIndexedValue(
    ctx,
    node.i,
    Object.create(null) as Record<string, AsyncServerValue>,
  );
  ctx.stack.push(node.i);
  deserializeProperties(ctx, node.d, result);
  ctx.stack.pop();
  return result;
}

function deserializeObject(
  ctx: SerializationContext,
  node: SerovalObjectNode,
) {
  const result = assignIndexedValue(ctx, node.i, {} as Record<string, AsyncServerValue>);
  ctx.stack.push(node.i);
  deserializeProperties(ctx, node.d, result);
  ctx.stack.pop();
  return result;
}

function deserializeSet(
  ctx: SerializationContext,
  node: SerovalSetNode,
) {
  const result = assignIndexedValue(ctx, node.i, new Set<unknown>());
  ctx.stack.push(node.i);
  for (let i = 0, len = node.a.length; i < len; i++) {
    result.add(deserializeTree(ctx, node.a[i]));
  }
  ctx.stack.pop();
  return result;
}

function deserializeMap(
  ctx: SerializationContext,
  node: SerovalMapNode,
) {
  const result = assignIndexedValue(
    ctx,
    node.i,
    new Map<unknown, unknown>(),
  );
  ctx.stack.push(node.i);
  for (let i = 0; i < node.d.s; i++) {
    result.set(
      deserializeTree(ctx, node.d.k[i]),
      deserializeTree(ctx, node.d.v[i]),
    );
  }
  ctx.stack.pop();
  return result;
}

type AssignableValue = AggregateError | Error | Iterable<AsyncServerValue>
type AssignableNode = SerovalAggregateErrorNode | SerovalErrorNode | SerovalIterableNode;

function deserializeDictionary<T extends AssignableValue>(
  ctx: SerializationContext,
  node: AssignableNode,
  result: T,
) {
  if (node.d) {
    ctx.stack.push(node.i);
    const fields = deserializeProperties(ctx, node.d, {});
    ctx.stack.pop();
    Object.assign(result, fields);
  }
  return result;
}

function deserializeAggregateError(
  ctx: SerializationContext,
  node: SerovalAggregateErrorNode,
) {
  // Serialize the required arguments
  const result = assignIndexedValue(ctx, node.i, new AggregateError([], deserializeString(node.m)));
  ctx.stack.push(node.i);
  result.errors = deserializeNodeList(ctx, node, new Array<AsyncServerValue>(node.l));
  ctx.stack.pop();
  // `AggregateError` might've been extended
  // either through class or custom properties
  // Make sure to assign extra properties
  return deserializeDictionary(ctx, node, result);
}

function deserializeError(
  ctx: SerializationContext,
  node: SerovalErrorNode,
) {
  const ErrorConstructor = getErrorConstructor(node.c);
  const result = assignIndexedValue(ctx, node.i, new ErrorConstructor(deserializeString(node.m)));
  return deserializeDictionary(ctx, node, result);
}

interface Deferred {
  resolve(value: unknown): void;
  promise: Promise<unknown>;
}

function createDeferred(): Deferred {
  let resolver: Deferred['resolve'];
  return {
    resolve(v) {
      resolver(v);
    },
    promise: new Promise((res) => {
      resolver = res as Deferred['resolve'];
    }),
  };
}

function deserializePromise(
  ctx: SerializationContext,
  node: SerovalPromiseNode,
) {
  const deferred = createDeferred();
  const result = assignIndexedValue(ctx, node.i, deferred.promise);
  deferred.resolve(deserializeTree(ctx, node.f));
  return result;
}

function deserializeArrayBuffer(
  ctx: SerializationContext,
  node: SerovalArrayBufferNode,
) {
  const bytes = new Uint8Array(node.s);
  const result = assignIndexedValue(ctx, node.i, bytes.buffer);
  return result;
}

function deserializeTypedArray(
  ctx: SerializationContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
) {
  const TypedArray = getTypedArrayConstructor(node.c);
  const source = deserializeTree(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(ctx, node.i, new TypedArray(
    source,
    node.b,
    node.l,
  ));
  return result;
}

function deserializeIterable(
  ctx: SerializationContext,
  node: SerovalIterableNode,
) {
  const values: AsyncServerValue[] = [];
  deserializeNodeList(ctx, node, values);
  const result = assignIndexedValue(ctx, node.i, {
    [Symbol.iterator]: () => values.values(),
  });
  return deserializeDictionary(ctx, node, result);
}

function deserializeDataView(
  ctx: SerializationContext,
  node: SerovalDataViewNode,
) {
  const source = deserializeTree(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(ctx, node.i, new DataView(
    source,
    node.b,
    node.l,
  ));
  return result;
}

function deserializeBlob(
  ctx: SerializationContext,
  node: SerovalBlobNode,
) {
  const source = deserializeTree(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(ctx, node.i, new Blob(
    [source],
    { type: node.c },
  ));
  return result;
}

export default function deserializeTree(
  ctx: SerializationContext,
  node: SerovalNode,
): unknown {
  switch (node.t) {
    case SerovalNodeType.Number:
    case SerovalNodeType.Boolean:
      return node.s;
    case SerovalNodeType.String:
      return deserializeString(node.s);
    case SerovalNodeType.Undefined:
      return undefined;
    case SerovalNodeType.Null:
      return null;
    case SerovalNodeType.NegativeZero:
      return -0;
    case SerovalNodeType.Infinity:
      return Infinity;
    case SerovalNodeType.NegativeInfinity:
      return -Infinity;
    case SerovalNodeType.NaN:
      return NaN;
    case SerovalNodeType.BigInt:
      return BigInt(node.s);
    case SerovalNodeType.IndexedValue:
      return ctx.valueMap.get(node.i);
    case SerovalNodeType.Array:
      return deserializeArray(ctx, node);
    case SerovalNodeType.Object:
      return deserializeObject(ctx, node);
    case SerovalNodeType.NullConstructor:
      return deserializeNullConstructor(ctx, node);
    case SerovalNodeType.Date:
      return assignIndexedValue(ctx, node.i, new Date(node.s));
    case SerovalNodeType.RegExp:
      return assignIndexedValue(ctx, node.i, new RegExp(node.c, node.m));
    case SerovalNodeType.Set:
      return deserializeSet(ctx, node);
    case SerovalNodeType.Map:
      return deserializeMap(ctx, node);
    case SerovalNodeType.ArrayBuffer:
      return deserializeArrayBuffer(ctx, node);
    case SerovalNodeType.BigIntTypedArray:
    case SerovalNodeType.TypedArray:
      return deserializeTypedArray(ctx, node);
    case SerovalNodeType.DataView:
      return deserializeDataView(ctx, node);
    case SerovalNodeType.AggregateError:
      return deserializeAggregateError(ctx, node);
    case SerovalNodeType.Error:
      return deserializeError(ctx, node);
    case SerovalNodeType.Iterable:
      return deserializeIterable(ctx, node);
    case SerovalNodeType.Promise:
      return deserializePromise(ctx, node);
    case SerovalNodeType.WKSymbol:
      return SYMBOL_REF[node.s];
    case SerovalNodeType.URL:
      return assignIndexedValue(ctx, node.i, new URL(deserializeString(node.s)));
    case SerovalNodeType.URLSearchParams:
      return assignIndexedValue(ctx, node.i, new URLSearchParams(deserializeString(node.s)));
    case SerovalNodeType.Reference:
      return assignIndexedValue(ctx, node.i, getReference(deserializeString(node.s)));
    case SerovalNodeType.Blob:
      return deserializeBlob(ctx, node);
    default:
      throw new Error('Unsupported type');
  }
}
