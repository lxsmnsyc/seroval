import type { Symbols } from './symbols';

export const enum SerovalConstant {
  Null = 0,
  Undefined = 1,
  True = 2,
  False = 3,
  NegativeZero = 4,
  Infinity = 5,
  NegativeInfinity = 6,
  NaN = 7,
}

export const enum SerovalNodeType {
  Number = 0,
  String = 1,
  Constant = 2,
  BigInt = 3,
  IndexedValue = 4,
  Date = 5,
  RegExp = 6,
  Set = 7,
  Map = 8,
  Array = 9,
  Object = 10,
  NullConstructor = 11,
  Promise = 12,
  Error = 13,
  AggregateError = 14,
  TypedArray = 15,
  BigIntTypedArray = 16,
  WKSymbol = 17,
  URL = 18,
  URLSearchParams = 19,
  Reference = 20,
  ArrayBuffer = 21,
  DataView = 22,
  Blob = 23,
  File = 24,
  Headers = 25,
  FormData = 26,
  Boxed = 27,
}

export interface SerovalBaseNode {
  // Type of the node
  t: SerovalNodeType;
  // Reference ID
  i: number | undefined;
  // Serialized value
  s: unknown;
  // size/length
  l: number | undefined;
  // Constructor name / RegExp source
  c: string | undefined;
  // message/flags
  m: string | undefined;
  // dictionary
  d: SerovalObjectRecordNode | SerovalMapRecordNode | undefined;
  // array of nodes
  a: (SerovalNode | undefined)[] | undefined;
  // fulfilled node
  f: SerovalNode | undefined;
  // byte offset
  b: number | undefined;
}

export const enum SerovalObjectRecordSpecialKey {
  SymbolIterator = 0,
}

export type SerovalObjectRecordKey =
  | string
  | SerovalObjectRecordSpecialKey;

export interface SerovalPlainRecordNode {
  k: string[];
  v: SerovalNode[];
  s: number;
}

export interface SerovalObjectRecordNode {
  k: SerovalObjectRecordKey[];
  v: SerovalNode[];
  s: number;
}

export interface SerovalMapRecordNode {
  k: SerovalNode[];
  v: SerovalNode[];
  s: number;
}

export interface SerovalNumberNode extends SerovalBaseNode {
  t: SerovalNodeType.Number;
  s: number;
}

export interface SerovalStringNode extends SerovalBaseNode {
  t: SerovalNodeType.String;
  s: string;
}

export interface SerovalConstantNode extends SerovalBaseNode {
  t: SerovalNodeType.Constant;
  s: SerovalConstant;
}

export type SerovalPrimitiveNode =
  | SerovalNumberNode
  | SerovalStringNode
  | SerovalConstantNode;

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
  a: (SerovalNode | undefined)[];
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
  i: number;
  // message
  m: string;
  // other properties
  d: SerovalObjectRecordNode | undefined;
}

export interface SerovalWKSymbolNode extends SerovalBaseNode {
  t: SerovalNodeType.WKSymbol;
  i: number;
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

export interface SerovalFileNode extends SerovalBaseNode {
  t: SerovalNodeType.File;
  i: number;
  // file type
  c: string;
  // file name
  m: string;
  // reference to array buffer
  f: SerovalNode;
  // last modified
  b: number;
}

export interface SerovalHeadersNode extends SerovalBaseNode {
  t: SerovalNodeType.Headers;
  i: number;
  d: SerovalPlainRecordNode;
}

export interface SerovalFormDataNode extends SerovalBaseNode {
  t: SerovalNodeType.FormData;
  i: number;
  d: SerovalPlainRecordNode;
}

export interface SerovalBoxedNode extends SerovalBaseNode {
  t: SerovalNodeType.Boxed;
  i: number;
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
  | SerovalWKSymbolNode
  | SerovalURLNode
  | SerovalURLSearchParamsNode
  | SerovalReferenceNode
  | SerovalArrayBufferNode
  | SerovalDataViewNode
  | SerovalBlobNode
  | SerovalFileNode
  | SerovalHeadersNode
  | SerovalFormDataNode
  | SerovalBoxedNode;
