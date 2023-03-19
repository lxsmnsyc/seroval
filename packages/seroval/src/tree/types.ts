import { Symbols } from './symbols';

export const enum SerovalNodeType {
  Number,
  String,
  Boolean,
  Null,
  Undefined,
  NegativeZero,
  Infinity,
  NegativeInfinity,
  NaN,
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
  WKSymbol,
}

export interface SerovalBaseNode {
  // Type of the node
  t: SerovalNodeType;
  // Reference ID
  i: number | undefined;
  // Serialized value
  s: any;
  // Size/Byte offset
  l: number | undefined;
  // Constructor name / RegExp source
  c: string | undefined;
  // message /flags
  m: string | undefined;
  // dictionary
  d: SerovalDictionaryNode | undefined;
  // array of nodes
  a: SerovalNode[] | undefined;
  // fulfilled node
  f: SerovalNode | undefined;
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

export interface SerovalNumberNode extends SerovalBaseNode {
  t: SerovalNodeType.Number;
  s: number;
}

export interface SerovalStringNode extends SerovalBaseNode {
  t: SerovalNodeType.String;
  s: string;
}

export interface SerovalBooleanNode extends SerovalBaseNode {
  t: SerovalNodeType.Boolean;
  s: boolean;
}

export interface SerovalNullNode extends SerovalBaseNode {
  t: SerovalNodeType.Null;
}

export interface SerovalUndefinedNode extends SerovalBaseNode {
  t: SerovalNodeType.Undefined;
}

export interface SerovalNegativeZeroNode extends SerovalBaseNode {
  t: SerovalNodeType.NegativeZero;
}

export interface SerovalInfinityNode extends SerovalBaseNode {
  t: SerovalNodeType.Infinity;
}

export interface SerovalNegativeInfinityNode extends SerovalBaseNode {
  t: SerovalNodeType.NegativeInfinity;
}

export interface SerovalNaNNode extends SerovalBaseNode {
  t: SerovalNodeType.NaN;
}

export type SerovalPrimitiveNode =
  | SerovalNumberNode
  | SerovalStringNode
  | SerovalBooleanNode
  | SerovalNullNode
  | SerovalUndefinedNode
  | SerovalNegativeZeroNode
  | SerovalNegativeInfinityNode
  | SerovalInfinityNode
  | SerovalNaNNode;

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
  // source
  c: string;
  // flags
  m: string;
}

export interface SerovalTypedArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.TypedArray;
  i: number;
  s: string[];
  l: number;
  c: string;
}

export interface SerovalBigIntTypedArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.BigIntTypedArray;
  i: number;
  s: string[];
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
  l: number;
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
  l: number;
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
  f: SerovalNode;
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
  l: number;
  a: SerovalNode[];
  i: number;
}

export interface SerovalIterableNode extends SerovalBaseNode {
  t: SerovalNodeType.Iterable;
  d: SerovalObjectRecordNode | undefined;
  l: number;
  a: SerovalNode[];
  i: number;
}

export interface SerovalWKSymbolNode extends SerovalBaseNode {
  t: SerovalNodeType.WKSymbol;
  s: Symbols;
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
  | SerovalIterableNode
  | SerovalWKSymbolNode;
