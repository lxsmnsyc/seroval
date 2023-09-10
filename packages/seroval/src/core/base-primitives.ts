import UnsupportedTypeError from './UnsupportedTypeError';
import assert from './assert';
import { Feature } from './compat';
import type { WellKnownSymbols } from './constants';
import { INV_SYMBOL_REF, SerovalNodeType } from './constants';
import type { BaseParserContext } from './context';
import {
  INFINITY_NODE,
  NEG_INFINITY_NODE,
  NAN_NODE,
  NEG_ZERO_NODE,
} from './literals';
import { getReferenceID } from './reference';
import { serializeString } from './string';
import type {
  SerovalArrayBufferNode,
  SerovalBigIntNode,
  SerovalConstantNode,
  SerovalDateNode,
  SerovalIndexedValueNode,
  SerovalNumberNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalStringNode,
  SerovalWKSymbolNode,
} from './types';

export function createNumberNode(value: number): SerovalConstantNode | SerovalNumberNode {
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
        p: undefined,
        e: undefined,
        a: undefined,
        f: undefined,
        b: undefined,
        o: undefined,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

export function createBigIntNode(
  ctx: BaseParserContext,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
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
    p: undefined,
    e: undefined,
    f: undefined,
    a: undefined,
    b: undefined,
    o: undefined,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}

export function createWKSymbolNode(
  ctx: BaseParserContext,
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
    p: undefined,
    e: undefined,
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
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
  };
}
