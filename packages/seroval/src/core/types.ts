import type {
  ErrorConstructorTag,
  SerovalConstant,
  SerovalNodeType,
  SerovalObjectFlags,
  Symbols,
} from './constants';
import type { SpecialReference } from './special-reference';

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
  // entries (for Map, etc.)
  e: SerovalMapRecordNode | undefined;
  // array of nodes
  a: (SerovalNode | undefined)[] | undefined;
  // fulfilled node
  f: SerovalNode | undefined;
  // byte offset/object flags
  b: number | undefined;
  // object flag
  o: SerovalObjectFlags | undefined;
}

export type SerovalObjectRecordKey = string | SerovalNode;

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
  f: SerovalNodeWithID;
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
  s: ErrorConstructorTag;
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

export interface SerovalBoxedNode extends SerovalBaseNode {
  t: SerovalNodeType.Boxed;
  i: number;
  f: SerovalNode;
}

export interface SerovalPromiseConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.PromiseConstructor;
  i: number;
  s: number;
  f: SerovalNodeWithID;
}

export interface SerovalPromiseResolveNode extends SerovalBaseNode {
  t: SerovalNodeType.PromiseSuccess;
  i: number;
  a: [resolver: SerovalNodeWithID, resolved: SerovalNode];
}

export interface SerovalPromiseRejectNode extends SerovalBaseNode {
  t: SerovalNodeType.PromiseFailure;
  i: number;
  a: [resolver: SerovalNodeWithID, resolved: SerovalNode];
}

export interface SerovalPluginNode extends SerovalBaseNode {
  t: SerovalNodeType.Plugin;
  i: number;
  // value
  s: unknown;
  // tag name
  c: string;
}

/**
 * Represents special values as placeholders
 */
export interface SerovalSpecialReferenceNode extends SerovalBaseNode {
  t: SerovalNodeType.SpecialReference;
  i: number;
  s: SpecialReference;
}

export interface SerovalIteratorFactoryNode extends SerovalBaseNode {
  t: SerovalNodeType.IteratorFactory;
  i: number;
  f: SerovalNodeWithID;
}

export interface SerovalIteratorFactoryInstanceNode extends SerovalBaseNode {
  t: SerovalNodeType.IteratorFactoryInstance;
  a: [instance: SerovalNodeWithID, sequence: SerovalNode];
}

export interface SerovalAsyncIteratorFactoryNode extends SerovalBaseNode {
  t: SerovalNodeType.AsyncIteratorFactory;
  i: number;
  a: [promise: SerovalNodeWithID, symbol: SerovalNodeWithID];
}

export interface SerovalAsyncIteratorFactoryInstanceNode
  extends SerovalBaseNode {
  t: SerovalNodeType.AsyncIteratorFactoryInstance;
  a: [instance: SerovalNodeWithID, sequence: SerovalNode];
}

export interface SerovalStreamConstructorNode extends SerovalBaseNode {
  t: SerovalNodeType.StreamConstructor;
  i: number;
  a: SerovalNode[];
  // special reference to the constructor
  f: SerovalNodeWithID;
}

export interface SerovalStreamNextNode extends SerovalBaseNode {
  t: SerovalNodeType.StreamNext;
  i: number;
  // Next value
  f: SerovalNode;
}

export interface SerovalStreamThrowNode extends SerovalBaseNode {
  t: SerovalNodeType.StreamThrow;
  i: number;
  // Throw value
  f: SerovalNode;
}

export interface SerovalStreamReturnNode extends SerovalBaseNode {
  t: SerovalNodeType.StreamReturn;
  i: number;
  // Return value
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
  | SerovalReferenceNode
  | SerovalArrayBufferNode
  | SerovalDataViewNode
  | SerovalBoxedNode
  | SerovalPluginNode
  | SerovalSpecialReferenceNode
  | SerovalIteratorFactoryNode
  | SerovalIteratorFactoryInstanceNode
  | SerovalAsyncIteratorFactoryNode
  | SerovalAsyncIteratorFactoryInstanceNode;

export type SerovalAsyncNode =
  | SerovalPromiseNode
  | SerovalPromiseConstructorNode
  | SerovalPromiseResolveNode
  | SerovalPromiseRejectNode
  | SerovalStreamConstructorNode
  | SerovalStreamNextNode
  | SerovalStreamThrowNode
  | SerovalStreamReturnNode;

export type SerovalNode = SerovalSyncNode | SerovalAsyncNode;

export type SerovalNodeWithID = Extract<SerovalNode, { i: number }>;
