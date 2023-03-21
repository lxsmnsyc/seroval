import assert from '../assert';
import { Feature } from '../compat';
import { ParserContext } from '../context';
import quote from '../quote';
import { BigIntTypedArrayValue, TypedArrayValue } from '../types';
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
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalStringNode,
  SerovalTypedArrayNode,
  SerovalUndefinedNode,
  SerovalWKSymbolNode,
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
  };
}

export function createStringNode(value: string): SerovalStringNode {
  return {
    t: SerovalNodeType.String,
    i: undefined,
    s: quote(value),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
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
  };
}

export function createReferenceNode(id: number): SerovalReferenceNode {
  return {
    t: SerovalNodeType.Reference,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
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
  };
}

export function createTypedArrayNode(
  ctx: ParserContext,
  id: number,
  current: TypedArrayValue,
): SerovalTypedArrayNode {
  const constructor = current.constructor.name;
  assert(ctx.features & Feature.TypedArray, `Unsupported value type "${constructor}"`);
  const len = current.length;
  const values = new Array<string>(len);
  for (let i = 0; i < len; i++) {
    values[i] = '' + current[i];
  }
  return {
    t: SerovalNodeType.TypedArray,
    i: id,
    s: values,
    l: current.byteOffset,
    c: constructor,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
  };
}

const BIGINT_FLAG = Feature.BigIntTypedArray | Feature.BigInt;

export function createBigIntTypedArrayNode(
  ctx: ParserContext,
  id: number,
  current: BigIntTypedArrayValue,
): SerovalBigIntTypedArrayNode {
  const constructor = current.constructor.name;
  assert(
    (ctx.features & BIGINT_FLAG) === BIGINT_FLAG,
    `Unsupported value type "${constructor}"`,
  );
  const len = current.length;
  const values = new Array<string>(len);
  for (let i = 0; i < len; i++) {
    values[i] = '' + current[i];
  }
  return {
    t: SerovalNodeType.BigIntTypedArray,
    i: id,
    s: values,
    l: current.byteOffset,
    c: constructor,
    m: undefined,
    d: undefined,
    a: undefined,
    f: undefined,
  };
}

export function createWKSymbolNode(
  current: WellKnownSymbols,
): SerovalWKSymbolNode {
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
  };
}
