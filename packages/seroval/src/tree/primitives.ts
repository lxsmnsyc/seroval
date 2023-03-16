import assert from '../assert';
import { Feature } from '../compat';
import { ParserContext } from '../context';
import { BigIntTypedArrayValue, TypedArrayValue } from '../types';
import {
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalDateNode,
  SerovalNodeType,
  SerovalPrimitiveNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalTypedArrayNode,
} from './types';

export function createPrimitiveNode(
  value: string | number | null,
): SerovalPrimitiveNode {
  return {
    t: SerovalNodeType.Primitive,
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

export const TRUE_NODE = createPrimitiveNode('!0');
export const FALSE_NODE = createPrimitiveNode('!1');
export const UNDEFINED_NODE = createPrimitiveNode('void 0');
export const NULL_NODE = createPrimitiveNode(null);
export const NEG_ZERO_NODE = createPrimitiveNode('-0');
export const INFINITY_NODE = createPrimitiveNode('1/0');
export const NEG_INFINITY_NODE = createPrimitiveNode('-1/0');

export function createBigIntNode(
  ctx: ParserContext,
  current: bigint,
): SerovalBigIntNode {
  assert(ctx.features & Feature.BigInt, 'Unsupported type "BigInt"');
  return {
    t: SerovalNodeType.BigInt,
    i: undefined,
    s: current.toString() + 'n',
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
    s: String(current),
    l: undefined,
    c: undefined,
    m: undefined,
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

export function createBigIntTypedArrayNode(
  ctx: ParserContext,
  id: number,
  current: BigIntTypedArrayValue,
): SerovalBigIntTypedArrayNode {
  const constructor = current.constructor.name;
  assert(
    ctx.features & (Feature.BigIntTypedArray),
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
