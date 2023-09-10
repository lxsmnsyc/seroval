import { SerovalConstant, SerovalNodeType } from './constants';
import type { SerovalConstantNode } from './types';

function createConstantNode(value: SerovalConstant): SerovalConstantNode {
  return {
    t: SerovalNodeType.Constant,
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

export const TRUE_NODE = createConstantNode(SerovalConstant.True);
export const FALSE_NODE = createConstantNode(SerovalConstant.False);
export const UNDEFINED_NODE = createConstantNode(SerovalConstant.Undefined);
export const NULL_NODE = createConstantNode(SerovalConstant.Null);
export const NEG_ZERO_NODE = createConstantNode(SerovalConstant.NegativeZero);
export const INFINITY_NODE = createConstantNode(SerovalConstant.Infinity);
export const NEG_INFINITY_NODE = createConstantNode(SerovalConstant.NegativeInfinity);
export const NAN_NODE = createConstantNode(SerovalConstant.NaN);
