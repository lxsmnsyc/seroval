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
  IndexedValue,
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
  URL,
  URLSearchParams,
  Reference,
  ArrayBuffer,
  DataView,
  Blob,
}

export interface SerovalBaseNode {
  // Type of the node
  t: SerovalNodeType;
  // Reference ID
  i: number | undefined;
  // Serialized value
  s: any;
  // size/length
  l: number | undefined;
  // Constructor name / RegExp source
  c: string | undefined;
  // message/flags
  m: string | undefined;
  // dictionary
  d: SerovalDictionaryNode | undefined;
  // array of nodes
  a: SerovalNode[] | undefined;
  // fulfilled node
  f: SerovalNode | undefined;
  // byte offset
  b: number | undefined;
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

export interface SerovalIndexedValueNode extends SerovalBaseNode {
  t: SerovalNodeType.IndexedValue;
  // id
  i: number;
}

export interface SerovalBigIntNode extends SerovalBaseNode {
  t: SerovalNodeType.BigInt;
  // value in string
  s: string;
}

export interface SerovalDateNode extends SerovalBaseNode {
  t: SerovalNodeType.Date;
  // id (Dates are stateful)
  i: number;
  // value in ISO string
  s: string;
}

export interface SerovalRegExpNode extends SerovalBaseNode {
  t: SerovalNodeType.RegExp;
  // id (RegExp are stateful)
  i: number;
  // source
  c: string;
  // flags
  m: string;
}

export interface SerovalArrayBufferNode extends SerovalBaseNode {
  t: SerovalNodeType.ArrayBuffer;
  // id
  i: number;
  // sequence in bytes
  s: number[];
}

export interface SerovalTypedArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.TypedArray;
  // id
  i: number;
  // length
  l: number;
  // TypedArray Constructor
  c: string;
  // ArrayBuffer reference
  f: SerovalNode;
  // Byte Offset
  b: number;
}

export interface SerovalBigIntTypedArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.BigIntTypedArray;
  i: number;
  // length
  l: number;
  // TypedArray Constructor
  c: string;
  // ArrayBuffer reference
  f: SerovalNode;
  // Byte Offset
  b: number;
}

export type SerovalSemiPrimitiveNode =
  | SerovalBigIntNode
  | SerovalDateNode
  | SerovalRegExpNode
  | SerovalTypedArrayNode
  | SerovalBigIntTypedArrayNode;

export interface SerovalSetNode extends SerovalBaseNode {
  t: SerovalNodeType.Set;
  // id
  i: number;
  // Size of Set
  l: number;
  // Items in Set (as array)
  a: SerovalNode[];
}

export interface SerovalMapNode extends SerovalBaseNode {
  t: SerovalNodeType.Map;
  i: number;
  // key/value pairs
  d: SerovalMapRecordNode;
}

export interface SerovalArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.Array;
  // size of array
  l: number;
  // items
  a: SerovalNode[];
  i: number;
}

export interface SerovalObjectNode extends SerovalBaseNode {
  t: SerovalNodeType.Object;
  // key/value pairs
  d: SerovalObjectRecordNode;
  i: number;
}

export interface SerovalNullConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.NullConstructor;
  // key/value pairs
  d: SerovalObjectRecordNode;
  i: number;
}

export interface SerovalPromiseNode extends SerovalBaseNode {
  t: SerovalNodeType.Promise;
  // resolved value
  f: SerovalNode;
  i: number;
}

export interface SerovalErrorNode extends SerovalBaseNode {
  t: SerovalNodeType.Error;
  // constructor name
  c: string;
  // message
  m: string;
  // other properties
  d: SerovalObjectRecordNode | undefined;
  i: number;
}

export interface SerovalAggregateErrorNode extends SerovalBaseNode {
  t: SerovalNodeType.AggregateError;
  // message
  m: string;
  // other properties
  d: SerovalObjectRecordNode | undefined;
  // length (number of errors)
  l: number;
  // array of errors
  a: SerovalNode[];
  i: number;
}

export interface SerovalIterableNode extends SerovalBaseNode {
  t: SerovalNodeType.Iterable;
  // other properties
  d: SerovalObjectRecordNode | undefined;
  // number of emitted items
  l: number;
  // array of items
  a: SerovalNode[];
  i: number;
}

export interface SerovalWKSymbolNode extends SerovalBaseNode {
  t: SerovalNodeType.WKSymbol;
  s: Symbols;
}

export interface SerovalURLNode extends SerovalBaseNode {
  t: SerovalNodeType.URL;
  i: number;
  // raw URL
  s: string;
}

export interface SerovalURLSearchParamsNode extends SerovalBaseNode {
  t: SerovalNodeType.URLSearchParams;
  i: number;
  // raw URL search params
  s: string;
}

export interface SerovalReferenceNode extends SerovalBaseNode {
  t: SerovalNodeType.Reference;
  i: number;
  // id of the reference in the map
  s: string;
}

export interface SerovalDataViewNode extends SerovalBaseNode {
  t: SerovalNodeType.DataView;
  i: number;
  // byte length
  l: number;
  // reference to array buffer
  f: SerovalNode;
  // byte offset
  b: number;
}

export interface SerovalBlobNode extends SerovalBaseNode {
  t: SerovalNodeType.Blob;
  i: number;
  // file type
  c: string;
  // reference to array buffer
  f: SerovalNode;
}

export type SerovalNode =
  | SerovalPrimitiveNode
  | SerovalIndexedValueNode
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
  | SerovalWKSymbolNode
  | SerovalURLNode
  | SerovalURLSearchParamsNode
  | SerovalReferenceNode
  | SerovalArrayBufferNode
  | SerovalDataViewNode
  | SerovalBlobNode;
