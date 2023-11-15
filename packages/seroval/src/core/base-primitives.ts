import type { BigIntTypedArrayValue, TypedArrayValue } from '../types';
import assert from './assert';
import type { WellKnownSymbols } from './constants';
import { INV_SYMBOL_REF, SerovalNodeType } from './constants';
import {
  INFINITY_NODE,
  NEG_INFINITY_NODE,
  NAN_NODE,
  NEG_ZERO_NODE,
} from './literals';
import { getReferenceID } from './reference';
import { getErrorConstructor, getObjectFlag } from './shared';
import { serializeString } from './string';
import type {
  SerovalArrayBufferNode,
  SerovalArrayNode,
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalConstantNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalIndexedValueNode,
  SerovalNode,
  SerovalNumberNode,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSetNode,
  SerovalStringNode,
  SerovalTypedArrayNode,
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
        x: undefined,
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
    x: undefined,
  };
}

export function createBigIntNode(
  current: bigint,
): SerovalBigIntNode {
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
    x: undefined,
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
    x: undefined,
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
    x: undefined,
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
    x: undefined,
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
    x: undefined,
  };
}

export function createWKSymbolNode(
  id: number,
  current: WellKnownSymbols,
): SerovalWKSymbolNode {
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
    x: undefined,
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
    x: undefined,
  };
}

export function createPluginNode(
  id: number,
  tag: string,
  value: unknown,
): SerovalPluginNode {
  return {
    t: SerovalNodeType.Plugin,
    i: id,
    s: value,
    l: undefined,
    c: serializeString(tag),
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
    x: undefined,
  };
}

export function createArrayNode(
  id: number,
  current: unknown[],
  parsedItems: SerovalNode[],
): SerovalArrayNode {
  return {
    t: SerovalNodeType.Array,
    i: id,
    s: undefined,
    l: current.length,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: parsedItems,
    f: undefined,
    b: undefined,
    o: getObjectFlag(current),
    x: undefined,
  };
}

export function createBoxedNode(
  id: number,
  boxed: SerovalNode,
): SerovalBoxedNode {
  return {
    t: SerovalNodeType.Boxed,
    i: id,
    s: undefined,
    l: undefined,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: undefined,
    f: boxed,
    b: undefined,
    o: undefined,
    x: undefined,
  };
}

export function createTypedArrayNode(
  id: number,
  current: TypedArrayValue,
  buffer: SerovalNode,
): SerovalTypedArrayNode {
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
    f: buffer,
    b: current.byteOffset,
    o: undefined,
    x: undefined,
  };
}

export function createBigIntTypedArrayNode(
  id: number,
  current: BigIntTypedArrayValue,
  buffer: SerovalNode,
): SerovalBigIntTypedArrayNode {
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
    f: buffer,
    b: current.byteOffset,
    o: undefined,
    x: undefined,
  };
}

export function createDataViewNode(
  id: number,
  current: DataView,
  buffer: SerovalNode,
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
    f: buffer,
    b: current.byteOffset,
    o: undefined,
    x: undefined,
  };
}

export function createErrorNode(
  id: number,
  current: Error,
  options: SerovalObjectRecordNode | undefined,
): SerovalErrorNode {
  return {
    t: SerovalNodeType.Error,
    i: id,
    s: getErrorConstructor(current),
    l: undefined,
    c: undefined,
    m: serializeString(current.message),
    p: options,
    e: undefined,
    a: undefined,
    f: undefined,
    b: undefined,
    o: undefined,
    x: undefined,
  };
}

export function createSetNode(
  id: number,
  size: number,
  items: SerovalNode[],
): SerovalSetNode {
  return {
    t: SerovalNodeType.Set,
    i: id,
    s: undefined,
    l: size,
    c: undefined,
    m: undefined,
    p: undefined,
    e: undefined,
    a: items,
    f: undefined,
    b: undefined,
    o: undefined,
    x: undefined,
  };
}
