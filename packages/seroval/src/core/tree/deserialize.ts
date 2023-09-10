/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-use-before-define */
import type {
  DeserializerContext,
} from './context';
import { deserializeString } from '../string';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import { getReference } from '../reference';
import { getErrorConstructor, getTypedArrayConstructor } from '../shared';
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
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
import {
  SYMBOL_REF,
  SerovalNodeType,
  SerovalObjectFlags,
  deserializeConstant,
} from '../constants';

function applyObjectFlag(obj: unknown, flag: SerovalObjectFlags): unknown {
  switch (flag) {
    case SerovalObjectFlags.Frozen:
      return Object.freeze(obj);
    case SerovalObjectFlags.NonExtensible:
      return Object.preventExtensions(obj);
    case SerovalObjectFlags.Sealed:
      return Object.seal(obj);
    default:
      return obj;
  }
}

function assignIndexedValue<T>(
  ctx: DeserializerContext,
  index: number,
  value: T,
): T {
  if (ctx.refs.has(index)) {
    ctx.values.set(index, value);
  }
  return value;
}

function deserializeArray(
  ctx: DeserializerContext,
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
  applyObjectFlag(result, node.o);
  return result;
}

function deserializeProperties(
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
  node: SerovalObjectNode | SerovalNullConstructorNode,
): Record<string, unknown> {
  const result = assignIndexedValue(
    ctx,
    node.i,
    (node.t === SerovalNodeType.Object
      ? {}
      : Object.create(null)) as Record<string, unknown>,
  );
  deserializeProperties(ctx, node.p, result);
  applyObjectFlag(result, node.o);
  return result;
}

function deserializeSet(
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
  node: SerovalMapNode,
): Map<unknown, unknown> {
  const result = assignIndexedValue(
    ctx,
    node.i,
    new Map<unknown, unknown>(),
  );
  const keys = node.e.k;
  const vals = node.e.v;
  for (let i = 0, len = node.e.s; i < len; i++) {
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
  ctx: DeserializerContext,
  node: AssignableNode,
  result: T,
): T {
  if (node.p) {
    const fields = deserializeProperties(ctx, node.p, {});
    Object.assign(result, fields);
  }
  return result;
}

function deserializeAggregateError(
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
  node: SerovalErrorNode,
): Error {
  const ErrorConstructor = getErrorConstructor(node.c);
  const result = assignIndexedValue(ctx, node.i, new ErrorConstructor(deserializeString(node.m)));
  return deserializeDictionary(ctx, node, result);
}

interface Deferred {
  resolve(value: unknown): void;
  reject(value: unknown): void;
  promise: Promise<unknown>;
}

function createDeferred(): Deferred {
  let resolve: Deferred['resolve'];
  let reject: Deferred['reject'];
  return {
    resolve(v): void {
      resolve(v);
    },
    reject(v): void {
      reject(v);
    },
    promise: new Promise((res, rej) => {
      resolve = res as Deferred['resolve'];
      reject = rej as Deferred['reject'];
    }),
  };
}

async function deserializePromise(
  ctx: DeserializerContext,
  node: SerovalPromiseNode,
): Promise<unknown> {
  const deferred = createDeferred();
  const result = assignIndexedValue(ctx, node.i, deferred.promise);
  const deserialized = deserializeTree(ctx, node.f);
  if (node.s) {
    deferred.resolve(deserialized);
  } else {
    deferred.reject(deserialized);
  }
  return result;
}

function deserializeArrayBuffer(
  ctx: DeserializerContext,
  node: SerovalArrayBufferNode,
): ArrayBuffer {
  const bytes = new Uint8Array(node.s);
  const result = assignIndexedValue(ctx, node.i, bytes.buffer);
  return result;
}

function deserializeTypedArray(
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
  node: SerovalDateNode,
): Date {
  return assignIndexedValue(ctx, node.i, new Date(node.s));
}

function deserializeRegExp(
  ctx: DeserializerContext,
  node: SerovalRegExpNode,
): RegExp {
  return assignIndexedValue(ctx, node.i, new RegExp(node.c, node.m));
}

function deserializeURL(
  ctx: DeserializerContext,
  node: SerovalURLNode,
): URL {
  return assignIndexedValue(ctx, node.i, new URL(deserializeString(node.s)));
}

function deserializeURLSearchParams(
  ctx: DeserializerContext,
  node: SerovalURLSearchParamsNode,
): URLSearchParams {
  return assignIndexedValue(ctx, node.i, new URLSearchParams(deserializeString(node.s)));
}

function deserializeReference(
  ctx: DeserializerContext,
  node: SerovalReferenceNode,
): unknown {
  return assignIndexedValue(ctx, node.i, getReference(deserializeString(node.s)));
}

function deserializeDataView(
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
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
  ctx: DeserializerContext,
  node: SerovalHeadersNode,
): Headers {
  const result = assignIndexedValue(ctx, node.i, new Headers());
  const keys = node.e.k;
  const vals = node.e.v;
  for (let i = 0, len = node.e.s; i < len; i++) {
    result.set(
      deserializeString(keys[i]),
      deserializeTree(ctx, vals[i]) as string,
    );
  }
  return result;
}

function deserializeFormData(
  ctx: DeserializerContext,
  node: SerovalFormDataNode,
): FormData {
  const result = assignIndexedValue(ctx, node.i, new FormData());
  const keys = node.e.k;
  const vals = node.e.v;
  for (let i = 0, len = node.e.s; i < len; i++) {
    result.set(
      deserializeString(keys[i]),
      deserializeTree(ctx, vals[i]) as FormDataEntryValue,
    );
  }
  return result;
}

function deserializeBoxed(
  ctx: DeserializerContext,
  node: SerovalBoxedNode,
): unknown {
  return assignIndexedValue(
    ctx,
    node.i,
    Object(deserializeTree(ctx, node.f)),
  );
}

export default function deserializeTree(
  ctx: DeserializerContext,
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
      return ctx.values.get(node.i);
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
