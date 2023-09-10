import assert from '../assert';
import { Feature } from '../compat';
import type { CrossParserContext } from './context';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import { hasReferenceID } from '../reference';
import type {
  SerovalBigIntTypedArrayNode,
  SerovalTypedArrayNode,
  SerovalDataViewNode,
  SerovalNode,
  SerovalIndexedValueNode,
  SerovalReferenceNode,
  SerovalWKSymbolNode,
} from '../types';
import type { WellKnownSymbols } from '../constants';
import { SerovalNodeType } from '../constants';
import {
  createIndexedValueNode,
  createArrayBufferNode,
  createWKSymbolNode,
  createReferenceNode,
} from '../base-primitives';

export function serializeArrayBuffer(
  ctx: CrossParserContext,
  current: ArrayBuffer,
): SerovalNode {
  const id = ctx.refs.get(current);
  if (id != null) {
    return createIndexedValueNode(id);
  }
  const newID = ctx.refs.size;
  ctx.refs.set(current, newID);
  return createArrayBufferNode(newID, current);
}

export function createTypedArrayNode(
  ctx: CrossParserContext,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteOffset,
    o: undefined,
  };
}

const BIGINT_FLAG = Feature.BigIntTypedArray | Feature.BigInt;

export function createBigIntTypedArrayNode(
  ctx: CrossParserContext,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteOffset,
    o: undefined,
  };
}

export function createDataViewNode(
  ctx: CrossParserContext,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteOffset,
    o: undefined,
  };
}

export function createSymbolNode(
  ctx: CrossParserContext,
  current: symbol,
): SerovalIndexedValueNode | SerovalReferenceNode | SerovalWKSymbolNode {
  const id = ctx.refs.get(current);
  if (id != null) {
    return createIndexedValueNode(id);
  }
  const newID = ctx.refs.size;
  ctx.refs.set(current, newID);
  if (hasReferenceID(current)) {
    return createReferenceNode(newID, current);
  }
  return createWKSymbolNode(ctx, newID, current as WellKnownSymbols);
}

export function createFunctionNode(
  ctx: CrossParserContext,
  // eslint-disable-next-line @typescript-eslint/ban-types
  current: Function,
): SerovalIndexedValueNode | SerovalReferenceNode {
  assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
  const id = ctx.refs.get(current);
  if (id != null) {
    return createIndexedValueNode(id);
  }
  const newID = ctx.refs.size;
  ctx.refs.set(current, newID);
  return createReferenceNode(newID, current);
}
