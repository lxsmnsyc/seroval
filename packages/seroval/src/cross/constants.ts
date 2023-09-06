import { SerovalConstant, SerovalNodeType } from '../constants';
import type { SerovalCrossConstantNode } from './types';

function createCrossConstantNode(value: SerovalConstant): SerovalCrossConstantNode {
  return {
    t: SerovalNodeType.Constant,
    i: undefined,
    s: value,
  };
}

export const TRUE_NODE = createCrossConstantNode(SerovalConstant.True);
export const FALSE_NODE = createCrossConstantNode(SerovalConstant.False);
export const UNDEFINED_NODE = createCrossConstantNode(SerovalConstant.Undefined);
export const NULL_NODE = createCrossConstantNode(SerovalConstant.Null);
export const NEG_ZERO_NODE = createCrossConstantNode(SerovalConstant.NegativeZero);
export const INFINITY_NODE = createCrossConstantNode(SerovalConstant.Infinity);
export const NEG_INFINITY_NODE = createCrossConstantNode(SerovalConstant.NegativeInfinity);
export const NAN_NODE = createCrossConstantNode(SerovalConstant.NaN);
