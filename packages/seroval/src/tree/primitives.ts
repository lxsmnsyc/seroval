import assert from '../assert';
import { Feature } from '../compat';
import type { ParserContext } from '../context';
import { createIndexedValue } from '../context';
import { serializeString } from '../string';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../types';
import UnsupportedTypeError from './UnsupportedTypeError';
import {
  INFINITY_NODE,
  NEG_INFINITY_NODE,
  NAN_NODE,
  NEG_ZERO_NODE,
} from './constants';
import { getReferenceID, hasReferenceID } from './reference';
import type { WellKnownSymbols } from './symbols';
import { INV_SYMBOL_REF } from './symbols';
import type {
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalDateNode,
  SerovalIndexedValueNode,
  SerovalRegExpNode,
  SerovalStringNode,
  SerovalTypedArrayNode,
  SerovalWKSymbolNode,
  SerovalReferenceNode,
  SerovalArrayBufferNode,
  SerovalDataViewNode,
  SerovalNode,
} from './types';
import {
  SerovalNodeType,
} from './types';

export function createNumberNode(value: number): SerovalNode {
  switch (value) {
    case Infinity:
      return INFINITY_NODE;
    case -Infinity:
      return NEG_INFINITY_NODE;
    default:
      // eslint-disable-next-line no-self-compare
      if (value !== value) {
        return NAN_NODE;
      }
      if (Object.is(value, -0)) {
        return NEG_ZERO_NODE;
      }
      return {
        t: SerovalNodeType.Number,
        i: undefined,
        s: value,
        l: undefined,
        c: undefined,
        m: undefined,
        d: undefined,
        a: undefined,
        f: undefined,
        b: undefined,
      };
  }
}

export function createStringNode(value: string): SerovalStringNode {
  return {
    t: SerovalNodeType.String,
    i: undefined,
    s: serializeString(value),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
  };
}

export function createBigIntNode(
  ctx: ParserContext,
  current: bigint,
): SerovalBigIntNode {
  assert(ctx.features & Feature.BigInt, new UnsupportedTypeError(current));
  return {
    t: SerovalNodeType.BigInt,
    i: undefined,
    s: '' + current,
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
  };
}

export function createIndexedValueNode(id: number): SerovalIndexedValueNode {
  return {
    t: SerovalNodeType.IndexedValue,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
  };
}

export function createDateNode(id: number, current: Date): SerovalDateNode {
  return {
    t: SerovalNodeType.Date,
    i: id,
    s: current.toISOString(),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
  };
}

export function createRegExpNode(id: number, current: RegExp): SerovalRegExpNode {
  return {
    t: SerovalNodeType.RegExp,
    i: id,
    s: undefined,
    l: undefined,
    c: current.source,
    m: current.flags,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
  };
}

export function createArrayBufferNode(
  id: number,
  current: ArrayBuffer,
): SerovalArrayBufferNode {
  const bytes = new Uint8Array(current);
  const len = bytes.length;
  const values = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    values[i] = bytes[i];
  }
  return {
    t: SerovalNodeType.ArrayBuffer,
    i: id,
    s: values,
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
  };
}

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
  };
}

export function createSymbolNode(
  ctx: ParserContext,
  current: symbol,
): SerovalNode {
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
): SerovalNode {
  assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
  const id = createIndexedValue(ctx, current);
  if (ctx.markedRefs.has(id)) {
    return createIndexedValueNode(id);
  }
  return createReferenceNode(id, current);
}
