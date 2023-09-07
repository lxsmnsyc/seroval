import assert from '../assert';
import { Feature } from '../compat';
import type { ParserContext } from './context';
import { createIndexedValue } from './context';
import { serializeString } from '../string';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import { getReferenceID, hasReferenceID } from '../reference';
import type {
  SerovalBigIntTypedArrayNode,
  SerovalTypedArrayNode,
  SerovalWKSymbolNode,
  SerovalReferenceNode,
  SerovalDataViewNode,
  SerovalNode,
  SerovalIndexedValueNode,
} from '../types';
import type { WellKnownSymbols } from '../constants';
import { SerovalNodeType, INV_SYMBOL_REF } from '../constants';
import { createArrayBufferNode, createIndexedValueNode } from '../base-primitives';

export function serializeArrayBuffer(
  ctx: ParserContext,
  current: ArrayBuffer,
): SerovalNode {
  const id = createIndexedValue(ctx, current);
  if (ctx.markedRefs.has(id)) {
    return createIndexedValueNode(id);
  }
  return createArrayBufferNode(id, current);
}

export function createTypedArrayNode(
  ctx: ParserContext,
  id: number,
  current: TypedArrayValue,
): SerovalTypedArrayNode {
  assert(ctx.features & Feature.TypedArray, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.TypedArray,
    i: id,
    s: undefined,
    l: current.length,
    c: current.constructor.name,
    m: undefined,
    d: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteOffset,
    o: undefined,
  };
}

const BIGINT_FLAG = Feature.BigIntTypedArray | Feature.BigInt;

export function createBigIntTypedArrayNode(
  ctx: ParserContext,
  id: number,
  current: BigIntTypedArrayValue,
): SerovalBigIntTypedArrayNode {
  assert(
    (ctx.features & BIGINT_FLAG) === BIGINT_FLAG,
    new UnsupportedTypeError(current),
  );
  return {
    t: SerovalNodeType.BigIntTypedArray,
    i: id,
    s: undefined,
    l: current.length,
    c: current.constructor.name,
    m: undefined,
    d: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteOffset,
    o: undefined,
  };
}

export function createWKSymbolNode(
  ctx: ParserContext,
  id: number,
  current: WellKnownSymbols,
): SerovalWKSymbolNode {
  assert(ctx.features & Feature.Symbol, new UnsupportedTypeError(current));
  assert(current in INV_SYMBOL_REF, new Error('Only well-known symbols are supported.'));
  return {
    t: SerovalNodeType.WKSymbol,
    i: id,
    s: INV_SYMBOL_REF[current],
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

export function createReferenceNode<T>(
  id: number,
  ref: T,
): SerovalReferenceNode {
  return {
    t: SerovalNodeType.Reference,
    i: id,
    s: serializeString(getReferenceID(ref)),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

export function createDataViewNode(
  ctx: ParserContext,
  id: number,
  current: DataView,
): SerovalDataViewNode {
  return {
    t: SerovalNodeType.DataView,
    i: id,
    s: undefined,
    l: current.byteLength,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteOffset,
    o: undefined,
  };
}

export function createSymbolNode(
  ctx: ParserContext,
  current: symbol,
): SerovalIndexedValueNode | SerovalReferenceNode | SerovalWKSymbolNode {
  const id = createIndexedValue(ctx, current);
  if (ctx.markedRefs.has(id)) {
    return createIndexedValueNode(id);
  }
  if (hasReferenceID(current)) {
    return createReferenceNode(id, current);
  }
  return createWKSymbolNode(ctx, id, current as WellKnownSymbols);
}

export function createFunctionNode(
  ctx: ParserContext,
  // eslint-disable-next-line @typescript-eslint/ban-types
  current: Function,
): SerovalIndexedValueNode | SerovalReferenceNode {
  assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
  const id = createIndexedValue(ctx, current);
  if (ctx.markedRefs.has(id)) {
    return createIndexedValueNode(id);
  }
  return createReferenceNode(id, current);
}
