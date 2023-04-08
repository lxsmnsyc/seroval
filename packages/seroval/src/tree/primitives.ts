import assert from '../assert';
import { Feature } from '../compat';
import { ParserContext, createIndexedValue } from '../context';
import { serializeString } from '../string';
import { BigIntTypedArrayValue, TypedArrayValue } from '../types';
import { getReferenceID } from './reference';
import { INV_SYMBOL_REF, WellKnownSymbols } from './symbols';
import {
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalBooleanNode,
  SerovalDateNode,
  SerovalInfinityNode,
  SerovalNaNNode,
  SerovalNegativeInfinityNode,
  SerovalNegativeZeroNode,
  SerovalNodeType,
  SerovalNullNode,
  SerovalNumberNode,
  SerovalIndexedValueNode,
  SerovalRegExpNode,
  SerovalStringNode,
  SerovalTypedArrayNode,
  SerovalUndefinedNode,
  SerovalWKSymbolNode,
  SerovalReferenceNode,
  SerovalArrayBufferNode,
} from './types';

export const TRUE_NODE: SerovalBooleanNode = {
  t: SerovalNodeType.Boolean,
  i: undefined,
  s: true,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const FALSE_NODE: SerovalBooleanNode = {
  t: SerovalNodeType.Boolean,
  i: undefined,
  s: false,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const UNDEFINED_NODE: SerovalUndefinedNode = {
  t: SerovalNodeType.Undefined,
  i: undefined,
  s: undefined,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const NULL_NODE: SerovalNullNode = {
  t: SerovalNodeType.Null,
  i: undefined,
  s: undefined,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const NEG_ZERO_NODE: SerovalNegativeZeroNode = {
  t: SerovalNodeType.NegativeZero,
  i: undefined,
  s: undefined,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const INFINITY_NODE: SerovalInfinityNode = {
  t: SerovalNodeType.Infinity,
  i: undefined,
  s: undefined,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const NEG_INFINITY_NODE: SerovalNegativeInfinityNode = {
  t: SerovalNodeType.NegativeInfinity,
  i: undefined,
  s: undefined,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};
export const NAN_NODE: SerovalNaNNode = {
  t: SerovalNodeType.NaN,
  i: undefined,
  s: undefined,
  l: undefined,
  c: undefined,
  m: undefined,
  d: undefined,
  a: undefined,
  f: undefined,
  b: undefined,
};

export function createNumberNode(value: number): SerovalNumberNode {
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
  assert(ctx.features & Feature.BigInt, 'Unsupported type "BigInt"');
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

function serializeArrayBuffer(
  ctx: ParserContext,
  current: ArrayBuffer,
) {
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
  const constructor = current.constructor.name;
  assert(ctx.features & Feature.TypedArray, `Unsupported value type "${constructor}"`);
  return {
    t: SerovalNodeType.TypedArray,
    i: id,
    s: undefined,
    l: current.byteOffset,
    c: constructor,
    m: undefined,
    d: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteLength,
  };
}

const BIGINT_FLAG = Feature.BigIntTypedArray | Feature.BigInt;

export function createBigIntTypedArrayNode(
  ctx: ParserContext,
  id: number,
  current: BigIntTypedArrayValue,
): SerovalBigIntTypedArrayNode {
  const constructor = current.constructor.name;
  console.log(ctx.features.toString(2), BIGINT_FLAG.toString(2), (ctx.features & BIGINT_FLAG).toString(2));
  assert(
    (ctx.features & BIGINT_FLAG) === BIGINT_FLAG,
    `Unsupported value type "${constructor}"`,
  );
  return {
    t: SerovalNodeType.BigIntTypedArray,
    i: id,
    s: undefined,
    l: current.byteOffset,
    c: constructor,
    m: undefined,
    d: undefined,
    a: undefined,
    f: serializeArrayBuffer(ctx, current.buffer),
    b: current.byteLength,
  };
}

export function createWKSymbolNode(
  ctx: ParserContext,
  current: WellKnownSymbols,
): SerovalWKSymbolNode {
  assert(ctx.features & Feature.Symbol, 'Unsupported type "symbol"');
  assert(current in INV_SYMBOL_REF, 'seroval only supports well-known symbols');
  return {
    t: SerovalNodeType.WKSymbol,
    i: undefined,
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
