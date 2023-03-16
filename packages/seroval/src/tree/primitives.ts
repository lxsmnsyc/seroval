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
  n: undefined,
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
  n: undefined,
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
  n: undefined,
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
  n: undefined,
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
  n: undefined,
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
  n: undefined,
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
  n: undefined,
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
  n: undefined,
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
    n: undefined,
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
    n: undefined,
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
    s: current.toString(),
    l: undefined,
    c: undefined,
    m: undefined,
    d: undefined,
    a: undefined,
    n: undefined,
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
    n: undefined,
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
    n: undefined,
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
    n: undefined,
  };
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
    s: current.toString(),
    l: current.byteOffset,
    c: constructor,
    m: undefined,
    d: undefined,
    a: undefined,
    n: undefined,
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
  let result = '';
  for (let i = 0, len = current.length; i < len; i++) {
    if (i !== 0) {
      result += ',';
    }
    result += current[i].toString() + 'n';
  }
  return {
    t: SerovalNodeType.BigIntTypedArray,
    i: id,
    s: result,
    l: (current as BigInt64Array).byteOffset,
    c: constructor,
    m: undefined,
    d: undefined,
    a: undefined,
    n: undefined,
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
    n: undefined,
  };
}
