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

export const TRUE_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.True,
);
export const FALSE_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.False,
);
export const UNDEFINED_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.Undefined,
);
export const NULL_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.Null,
);
export const NEG_ZERO_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.NegativeZero,
);
export const INFINITY_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.Infinity,
);
export const NEG_INFINITY_NODE = /* @__PURE__ */ createConstantNode(
  SerovalConstant.NegativeInfinity,
);
export const NAN_NODE = /* @__PURE__ */ createConstantNode(SerovalConstant.NaN);
