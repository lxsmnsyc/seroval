import {
  SerovalPrimitiveNode,
} from './types';

export const TRUE_NODE = new SerovalPrimitiveNode('!0');
export const FALSE_NODE = new SerovalPrimitiveNode('!1');
export const UNDEFINED_NODE = new SerovalPrimitiveNode('void 0');
export const NULL_NODE = new SerovalPrimitiveNode(null);
export const NEG_ZERO_NODE = new SerovalPrimitiveNode('-0');
export const INFINITY_NODE = new SerovalPrimitiveNode('1/0');
export const NEG_INFINITY_NODE = new SerovalPrimitiveNode('-1/0');
