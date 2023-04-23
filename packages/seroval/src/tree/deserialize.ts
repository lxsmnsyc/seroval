/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-use-before-define */
import type {
  SerializationContext,
} from '../context';
import { deserializeString } from '../string';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../types';
import { deserializeConstant } from './constants';
import { getReference } from './reference';
import { getErrorConstructor, getTypedArrayConstructor } from './shared';
import { SYMBOL_REF } from './symbols';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayBufferNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalBlobNode,
  SerovalBoxedNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalFileNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
  SerovalURLNode,
  SerovalURLSearchParamsNode,
} from './types';
import {
  SerovalNodeType,
  SerovalObjectRecordSpecialKey,
} from './types';

function assignIndexedValue<T>(
  ctx: SerializationContext,
  index: number,
  value: T,
): T {
  if (ctx.markedRefs.has(index)) {
    ctx.valueMap.set(index, value);
  }
  return value;
}

function deserializeArray(
  ctx: SerializationContext,
  node: SerovalArrayNode,
): unknown[] {
  const len = node.l;
  const result: unknown[] = assignIndexedValue(
    ctx,
    node.i,
    new Array<unknown>(len),
  );
  let item: SerovalNode | undefined;
  for (let i = 0; i < len; i++) {
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
  result: Record<string | symbol, unknown>,
): Record<string | symbol, unknown> {
  const len = node.s;
  if (len) {
    let key: SerovalObjectRecordKey;
    let value: unknown;
    const keys = node.k;
    const vals = node.v;
    for (let i = 0; i < len; i++) {
      key = keys[i];
      value = deserializeTree(ctx, vals[i]);
      switch (key) {
        case SerovalObjectRecordSpecialKey.SymbolIterator: {
          const current = value as unknown[];
          result[Symbol.iterator] = (): IterableIterator<unknown> => current.values();
        }
          break;
        default:
          result[deserializeString(key)] = value;
          break;
      }
    }
  }
  return result;
}

function deserializeObject(
  ctx: SerializationContext,
  node: SerovalObjectNode | SerovalNullConstructorNode,
): Record<string, unknown> {
  const result = assignIndexedValue(
    ctx,
    node.i,
    (node.t === SerovalNodeType.Object
      ? {}
      : Object.create(null)) as Record<string, unknown>,
  );
  deserializeProperties(ctx, node.d, result);
  return result;
}

function deserializeSet(
  ctx: SerializationContext,
  node: SerovalSetNode,
): Set<unknown> {
  const result = assignIndexedValue(ctx, node.i, new Set<unknown>());
  const items = node.a;
  for (let i = 0, len = node.l; i < len; i++) {
    result.add(deserializeTree(ctx, items[i]));
  }
  return result;
}

function deserializeMap(
  ctx: SerializationContext,
  node: SerovalMapNode,
): Map<unknown, unknown> {
  const result = assignIndexedValue(
    ctx,
    node.i,
    new Map<unknown, unknown>(),
  );
  const keys = node.d.k;
  const vals = node.d.v;
  for (let i = 0, len = node.d.s; i < len; i++) {
    result.set(
      deserializeTree(ctx, keys[i]),
      deserializeTree(ctx, vals[i]),
    );
  }
  return result;
}

type AssignableValue = AggregateError | Error | Iterable<unknown>
type AssignableNode = SerovalAggregateErrorNode | SerovalErrorNode;

function deserializeDictionary<T extends AssignableValue>(
  ctx: SerializationContext,
  node: AssignableNode,
  result: T,
): T {
  if (node.d) {
    const fields = deserializeProperties(ctx, node.d, {});
    Object.assign(result, fields);
  }
  return result;
}

function deserializeAggregateError(
  ctx: SerializationContext,
  node: SerovalAggregateErrorNode,
): AggregateError {
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
): Error {
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
    resolve(v): void {
      resolver(v);
    },
    promise: new Promise((res) => {
      resolver = res as Deferred['resolve'];
    }),
  };
}

async function deserializePromise(
  ctx: SerializationContext,
  node: SerovalPromiseNode,
): Promise<unknown> {
  const deferred = createDeferred();
  const result = assignIndexedValue(ctx, node.i, deferred.promise);
  deferred.resolve(deserializeTree(ctx, node.f));
  return result;
}

function deserializeArrayBuffer(
  ctx: SerializationContext,
  node: SerovalArrayBufferNode,
): ArrayBuffer {
  const bytes = new Uint8Array(node.s);
  const result = assignIndexedValue(ctx, node.i, bytes.buffer);
  return result;
}

function deserializeTypedArray(
  ctx: SerializationContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
): TypedArrayValue | BigIntTypedArrayValue {
  const TypedArray = getTypedArrayConstructor(node.c);
  const source = deserializeTree(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(ctx, node.i, new TypedArray(
    source,
    node.b,
    node.l,
  ));
  return result;
}

function deserializeDate(
  ctx: SerializationContext,
  node: SerovalDateNode,
): Date {
  return assignIndexedValue(ctx, node.i, new Date(node.s));
}

function deserializeRegExp(
  ctx: SerializationContext,
  node: SerovalRegExpNode,
): RegExp {
  return assignIndexedValue(ctx, node.i, new RegExp(node.c, node.m));
}

function deserializeURL(
  ctx: SerializationContext,
  node: SerovalURLNode,
): URL {
  return assignIndexedValue(ctx, node.i, new URL(deserializeString(node.s)));
}

function deserializeURLSearchParams(
  ctx: SerializationContext,
  node: SerovalURLSearchParamsNode,
): URLSearchParams {
  return assignIndexedValue(ctx, node.i, new URLSearchParams(deserializeString(node.s)));
}

function deserializeReference(
  ctx: SerializationContext,
  node: SerovalReferenceNode,
): unknown {
  return assignIndexedValue(ctx, node.i, getReference(deserializeString(node.s)));
}

function deserializeDataView(
  ctx: SerializationContext,
  node: SerovalDataViewNode,
): DataView {
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
): Blob {
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
): File {
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
): Headers {
  const result = assignIndexedValue(ctx, node.i, new Headers());
  const keys = node.d.k;
  const vals = node.d.v;
  for (let i = 0, len = node.d.s; i < len; i++) {
    result.set(
      deserializeString(keys[i]),
      deserializeTree(ctx, vals[i]) as string,
    );
  }
  return result;
}

function deserializeFormData(
  ctx: SerializationContext,
  node: SerovalFormDataNode,
): FormData {
  const result = assignIndexedValue(ctx, node.i, new FormData());
  const keys = node.d.k;
  const vals = node.d.v;
  for (let i = 0, len = node.d.s; i < len; i++) {
    result.set(
      deserializeString(keys[i]),
      deserializeTree(ctx, vals[i]) as FormDataEntryValue,
    );
  }
  return result;
}

function deserializeBoxed(
  ctx: SerializationContext,
  node: SerovalBoxedNode,
): unknown {
  return assignIndexedValue(
    ctx,
    node.i,
    Object(deserializeTree(ctx, node.f)),
  );
}

export default function deserializeTree(
  ctx: SerializationContext,
  node: SerovalNode,
): unknown {
  switch (node.t) {
    case SerovalNodeType.Constant:
      return deserializeConstant(node);
    case SerovalNodeType.Number:
      return node.s;
    case SerovalNodeType.String:
      return deserializeString(node.s);
    case SerovalNodeType.BigInt:
      return BigInt(node.s);
    case SerovalNodeType.IndexedValue:
      return ctx.valueMap.get(node.i);
    case SerovalNodeType.Array:
      return deserializeArray(ctx, node);
    case SerovalNodeType.Object:
    case SerovalNodeType.NullConstructor:
      return deserializeObject(ctx, node);
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
    case SerovalNodeType.Boxed:
      return deserializeBoxed(ctx, node);
    default:
      throw new Error('invariant');
  }
}
