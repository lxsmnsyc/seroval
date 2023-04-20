import { SerovalConstant, SerovalConstantNode, SerovalNodeType } from './types';

function createConstantNode(value: SerovalConstant): SerovalConstantNode {
  return {
    t: SerovalNodeType.Constant,
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

export const TRUE_NODE = createConstantNode(SerovalConstant.True);
export const FALSE_NODE = createConstantNode(SerovalConstant.False);
export const UNDEFINED_NODE = createConstantNode(SerovalConstant.Undefined);
export const NULL_NODE = createConstantNode(SerovalConstant.Null);
export const NEG_ZERO_NODE = createConstantNode(SerovalConstant.NegativeZero);
export const INFINITY_NODE = createConstantNode(SerovalConstant.Infinity);
export const NEG_INFINITY_NODE = createConstantNode(SerovalConstant.NegativeInfinity);
export const NAN_NODE = createConstantNode(SerovalConstant.NaN);

export function serializeConstant(node: SerovalConstantNode): string {
  switch (node.s) {
    case SerovalConstant.True:
      return '!0';
    case SerovalConstant.False:
      return '!1';
    case SerovalConstant.Undefined:
      return 'void 0';
    case SerovalConstant.Null:
      return 'null';
    case SerovalConstant.NegativeZero:
      return '-0';
    case SerovalConstant.Infinity:
      return '1/0';
    case SerovalConstant.NegativeInfinity:
      return '-1/0';
    case SerovalConstant.NaN:
      return 'NaN';
    default:
      throw new Error('invariant');
  }
}

export function deserializeConstant(node: SerovalConstantNode): unknown {
  switch (node.s) {
    case SerovalConstant.True:
      return true;
    case SerovalConstant.False:
      return false;
    case SerovalConstant.Undefined:
      return undefined;
    case SerovalConstant.Null:
      return null;
    case SerovalConstant.NegativeZero:
      return -0;
    case SerovalConstant.Infinity:
      return Infinity;
    case SerovalConstant.NegativeInfinity:
      return -Infinity;
    case SerovalConstant.NaN:
      return NaN;
    default:
      throw new Error('invariant');
  }
}
