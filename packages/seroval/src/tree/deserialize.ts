/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  SerializationContext,
} from '../context';
import { deserializeString } from '../string';
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
  SerovalDateNode,
  SerovalErrorNode,
  SerovalFileNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeType,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
  SerovalURLNode,
  SerovalURLSearchParamsNode,
} from './types';

function assignIndexedValue<T>(
  ctx: SerializationContext,
  index: number,
  value: T,
) {
  if (ctx.markedRefs.has(index)) {
    ctx.valueMap.set(index, value);
  }
  return value;
}

function deserializeArray(
  ctx: SerializationContext,
  node: SerovalArrayNode,
) {
  const result: unknown[] = assignIndexedValue(
    ctx,
    node.i,
    new Array<unknown>(node.l),
  );
  let item: SerovalNode;
  for (let i = 0, len = node.l; i < len; i++) {
    item = node.a[i];
    if (item) {
      result[i] = deserializeTree(ctx, item);
    }
  }
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
    Object.create(null) as Record<string, unknown>,
  );
  deserializeProperties(ctx, node.d, result);
  return result;
}

function deserializeObject(
  ctx: SerializationContext,
  node: SerovalObjectNode,
) {
  const result = assignIndexedValue(ctx, node.i, {} as Record<string, unknown>);
  deserializeProperties(ctx, node.d, result);
  return result;
}

function deserializeSet(
  ctx: SerializationContext,
  node: SerovalSetNode,
) {
  const result = assignIndexedValue(ctx, node.i, new Set<unknown>());
  for (let i = 0, len = node.l; i < len; i++) {
    result.add(deserializeTree(ctx, node.a[i]));
  }
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
  for (let i = 0, len = node.d.s; i < len; i++) {
    result.set(
      deserializeTree(ctx, node.d.k[i]),
      deserializeTree(ctx, node.d.v[i]),
    );
  }
  return result;
}

type AssignableValue = AggregateError | Error | Iterable<unknown>
type AssignableNode = SerovalAggregateErrorNode | SerovalErrorNode | SerovalIterableNode;

function deserializeDictionary<T extends AssignableValue>(
  ctx: SerializationContext,
  node: AssignableNode,
  result: T,
) {
  if (node.d) {
    const fields = deserializeProperties(ctx, node.d, {});
    Object.assign(result, fields);
  }
  return result;
}

function deserializeAggregateError(
  ctx: SerializationContext,
  node: SerovalAggregateErrorNode,
) {
  // Serialize the required arguments
  const result = assignIndexedValue(
    ctx,
    node.i,
    new AggregateError([], deserializeString(node.m)),
  );
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
  const values: unknown[] = [];
  let item: SerovalNode;
  for (let i = 0, len = node.l; i < len; i++) {
    item = node.a[i];
    if (item) {
      values[i] = deserializeTree(ctx, item);
    }
  }
  const result: Iterable<unknown> = assignIndexedValue(ctx, node.i, {
    [Symbol.iterator]: () => values.values(),
  });
  return deserializeDictionary(ctx, node, result);
}

function deserializeDate(
  ctx: SerializationContext,
  node: SerovalDateNode,
) {
  return assignIndexedValue(ctx, node.i, new Date(node.s));
}

function deserializeRegExp(
  ctx: SerializationContext,
  node: SerovalRegExpNode,
) {
  return assignIndexedValue(ctx, node.i, new RegExp(node.c, node.m));
}

function deserializeURL(
  ctx: SerializationContext,
  node: SerovalURLNode,
) {
  return assignIndexedValue(ctx, node.i, new URL(deserializeString(node.s)));
}

function deserializeURLSearchParams(
  ctx: SerializationContext,
  node: SerovalURLSearchParamsNode,
) {
  return assignIndexedValue(ctx, node.i, new URLSearchParams(deserializeString(node.s)));
}

function deserializeReference(
  ctx: SerializationContext,
  node: SerovalReferenceNode,
) {
  return assignIndexedValue(ctx, node.i, getReference(deserializeString(node.s)));
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
    { type: deserializeString(node.c) },
  ));
  return result;
}

function deserializeFile(
  ctx: SerializationContext,
  node: SerovalFileNode,
) {
  const source = deserializeTree(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(ctx, node.i, new File(
    [source],
    deserializeString(node.m),
    { type: deserializeString(node.c), lastModified: node.b },
  ));
  return result;
}

function deserializeHeaders(
  ctx: SerializationContext,
  node: SerovalHeadersNode,
) {
  const result = assignIndexedValue(ctx, node.i, new Headers());
  for (let i = 0, len = node.d.s; i < len; i++) {
    result.set(
      deserializeString(node.d.k[i]),
      deserializeTree(ctx, node.d.v[i]) as string,
    );
  }
  return result;
}

function deserializeFormData(
  ctx: SerializationContext,
  node: SerovalFormDataNode,
) {
  const result = assignIndexedValue(ctx, node.i, new FormData());
  for (let i = 0, len = node.d.s; i < len; i++) {
    result.set(
      deserializeString(node.d.k[i]),
      deserializeTree(ctx, node.d.v[i]) as FormDataEntryValue,
    );
  }
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
      return deserializeDate(ctx, node);
    case SerovalNodeType.RegExp:
      return deserializeRegExp(ctx, node);
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
      return deserializeURL(ctx, node);
    case SerovalNodeType.URLSearchParams:
      return deserializeURLSearchParams(ctx, node);
    case SerovalNodeType.Reference:
      return deserializeReference(ctx, node);
    case SerovalNodeType.Blob:
      return deserializeBlob(ctx, node);
    case SerovalNodeType.File:
      return deserializeFile(ctx, node);
    case SerovalNodeType.Headers:
      return deserializeHeaders(ctx, node);
    case SerovalNodeType.FormData:
      return deserializeFormData(ctx, node);
    default:
      throw new Error('Unsupported type');
  }
}
