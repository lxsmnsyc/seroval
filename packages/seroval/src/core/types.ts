import type {
  SerovalNodeType,
  SerovalObjectFlags,
  SerovalConstant,
  Symbols,
} from './constants';

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
  // properties (objects)
  p: SerovalObjectRecordNode | undefined;
  // entries (for Map, Headers, etc.)
  e: SerovalMapRecordNode | SerovalPlainRecordNode | undefined;
  // array of nodes
  a: (SerovalNode | undefined)[] | undefined;
  // fulfilled node
  f: SerovalNode | undefined;
  // byte offset/object flags
  b: number | undefined;
  // object flag
  o: SerovalObjectFlags | undefined;
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
  e: SerovalMapRecordNode;
}

export interface SerovalArrayNode extends SerovalBaseNode {
  t: SerovalNodeType.Array;
  // size of array
  l: number;
  // items
  a: (SerovalNode | undefined)[];
  i: number;
  o: SerovalObjectFlags;
}

export interface SerovalObjectNode extends SerovalBaseNode {
  t: SerovalNodeType.Object;
  // key/value pairs
  p: SerovalObjectRecordNode;
  i: number;
  o: SerovalObjectFlags;
}

export interface SerovalNullConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.NullConstructor;
  // key/value pairs
  p: SerovalObjectRecordNode;
  i: number;
  o: SerovalObjectFlags;
}

export interface SerovalPromiseNode extends SerovalBaseNode {
  t: SerovalNodeType.Promise;
  s: 0 | 1;
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
  p: SerovalObjectRecordNode | undefined;
  i: number;
}

export interface SerovalAggregateErrorNode extends SerovalBaseNode {
  t: SerovalNodeType.AggregateError;
  i: number;
  // message
  m: string;
  // other properties
  p: SerovalObjectRecordNode | undefined;
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
  e: SerovalPlainRecordNode;
}

export interface SerovalFormDataNode extends SerovalBaseNode {
  t: SerovalNodeType.FormData;
  i: number;
  e: SerovalPlainRecordNode;
}

export interface SerovalBoxedNode extends SerovalBaseNode {
  t: SerovalNodeType.Boxed;
  i: number;
  f: SerovalNode;
}

export interface SerovalPromiseConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.PromiseConstructor;
  i: number;
}

export interface SerovalPromiseResolveNode extends SerovalBaseNode {
  t: SerovalNodeType.PromiseResolve;
  // reference to the resolver
  i: number;
  f: SerovalNode;
}

export interface SerovalPromiseRejectNode extends SerovalBaseNode {
  t: SerovalNodeType.PromiseReject;
  // reference to the resolver
  i: number;
  f: SerovalNode;
}

export interface SerovalReadableStreamConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.ReadableStreamConstructor;
  i: number;
}

export interface SerovalReadableStreamEnqueueNode extends SerovalBaseNode {
  t: SerovalNodeType.ReadableStreamEnqueue;
  i: number;
  f: SerovalNode;
}

export interface SerovalReadableStreamCloseNode extends SerovalBaseNode {
  t: SerovalNodeType.ReadableStreamClose;
  i: number;
}

export interface SerovalReadableStreamErrorNode extends SerovalBaseNode {
  t: SerovalNodeType.ReadableStreamError;
  i: number;
  f: SerovalNode;
}

export type SerovalSyncNode =
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

export type SerovalAsyncNode =
  | SerovalPromiseNode
  | SerovalBlobNode
  | SerovalFileNode
  | SerovalPromiseConstructorNode
  | SerovalPromiseResolveNode
  | SerovalPromiseRejectNode
  | SerovalReadableStreamConstructorNode
  | SerovalReadableStreamEnqueueNode
  | SerovalReadableStreamCloseNode
  | SerovalReadableStreamErrorNode;

export type SerovalNode =
  | SerovalSyncNode
  | SerovalAsyncNode;
