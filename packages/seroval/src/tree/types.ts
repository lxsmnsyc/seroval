import { PrimitiveValue } from '../types';

export const enum SerovalNodeType {
  Primitive,
  BigInt,
  Reference,
  Date,
  RegExp,
  Set,
  Map,
  Array,
  Object,
  NullConstructor,
  Promise,
  Error,
  AggregateError,
  Iterable,
  TypedArray,
  BigIntTypedArray,
}

export interface SerovalBaseNode {
  // Type of the node
  t: SerovalNodeType;
  // Serialized value
  s: PrimitiveValue | undefined;
  // Reference ID
  i: number | undefined;
  // Size/Byte offset
  l: number | undefined;
  // Constructor name
  c: string | undefined;
  // dictionary
  d: SerovalDictionaryNode | undefined;
  // message
  m: string | undefined;
  // next node
  n: SerovalNode | undefined;
  // array of nodes
  a: SerovalNode[] | undefined;
}

export interface SerovalObjectRecordNode {
  k: string[];
  v: SerovalNode[];
  s: number;
}

export interface SerovalMapRecordNode {
  k: SerovalNode[];
  v: SerovalNode[];
  s: number;
}

export type SerovalDictionaryNode =
  | SerovalObjectRecordNode
  | SerovalMapRecordNode;

export interface SerovalPrimitiveNode extends SerovalBaseNode {
  t: SerovalNodeType.Primitive;
}

export interface SerovalReferenceNode extends SerovalBaseNode {
  t: SerovalNodeType.Reference;
  i: number;
}

export interface SerovalBigIntNode extends SerovalBaseNode {
  t: SerovalNodeType.BigInt;
  s: string;
}

export interface SerovalDateNode extends SerovalBaseNode {
  t: SerovalNodeType.Date;
  i: number;
  s: string;
}

export interface SerovalRegExpNode extends SerovalBaseNode {
  t: SerovalNodeType.RegExp;
  i: number;
  s: string;
}

export interface SerovalTypedArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.TypedArray;
  i: number;
  s: string;
  l: number;
  c: string;
}

export interface SerovalBigIntTypedArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.BigIntTypedArray;
  i: number;
  s: string;
  l: number;
  c: string;
}

export type SerovalSemiPrimitiveNode =
  | SerovalBigIntNode
  | SerovalDateNode
  | SerovalRegExpNode
  | SerovalTypedArrayNode
  | SerovalBigIntTypedArrayNode;

export interface SerovalSetNode extends SerovalBaseNode {
  t: SerovalNodeType.Set;
  a: SerovalNode[];
  i: number;
}

export interface SerovalMapNode extends SerovalBaseNode {
  t: SerovalNodeType.Map;
  d: SerovalMapRecordNode;
  i: number;
}

export interface SerovalArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.Array;
  a: SerovalNode[];
  i: number;
}

export interface SerovalObjectNode extends SerovalBaseNode {
  t: SerovalNodeType.Object;
  d: SerovalObjectRecordNode;
  i: number;
}

export interface SerovalNullConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.NullConstructor;
  d: SerovalObjectRecordNode;
  i: number;
}

export interface SerovalPromiseNode extends SerovalBaseNode {
  t: SerovalNodeType.Promise;
  n: SerovalNode;
  i: number;
}

export interface SerovalErrorNode extends SerovalBaseNode {
  t: SerovalNodeType.Error;
  c: string;
  m: string;
  d: SerovalObjectRecordNode | undefined;
  i: number;
}

export interface SerovalAggregateErrorNode extends SerovalBaseNode {
  t: SerovalNodeType.AggregateError;
  m: string;
  d: SerovalObjectRecordNode | undefined;
  n: SerovalNode;
  i: number;
}

export interface SerovalIterableNode extends SerovalBaseNode {
  t: SerovalNodeType.Iterable;
  d: SerovalObjectRecordNode | undefined;
  a: SerovalNode[];
  i: number;
}

export type SerovalNode =
  | SerovalPrimitiveNode
  | SerovalReferenceNode
  | SerovalSemiPrimitiveNode
  | SerovalSetNode
  | SerovalMapNode
  | SerovalArrayNode
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode
  | SerovalErrorNode
  | SerovalAggregateErrorNode
  | SerovalIterableNode;
