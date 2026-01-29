import type {
  BigIntTypedArrayTag,
  ErrorConstructorTag,
  SerovalConstant,
  SerovalObjectFlags,
  Symbols,
  TypedArrayTag,
} from '../core/constants';

export const enum SerovalNodeType {
  Root = 0,
  Constant = 1,
  Number = 2,
  String = 3,
  BigInt = 4,
  WKSymbol = 5,
  ObjectAssign = 6,
  ArrayAssign = 7,
  Add = 8,
  Throw = 9,
  Return = 10,
  Close = 11,
  Array = 12,
  Stream = 13,
  Sequence = 14,
  Plugin = 15,
  Object = 16,
  NullConstructor = 17,
  Date = 18,
  Error = 19,
  Boxed = 20,
  ArrayBuffer = 21,
  TypedArray = 22,
  BigIntTypedArray = 23,
  DataView = 24,
  Map = 25,
  Set = 26,
  Promise = 27,
  RegExp = 28,
  AggregateError = 29,
}

export type SerovalConstantNode = [
  type: SerovalNodeType.Constant,
  id: number,
  value: SerovalConstant,
];
export type SerovalNumberNode = [
  type: SerovalNodeType.Number,
  id: number,
  value: number,
];
export type SerovalStringNode = [
  type: SerovalNodeType.String,
  id: number,
  value: string,
];
export type SerovalBigintNode = [
  type: SerovalNodeType.BigInt,
  id: number,
  // value ref
  value: number,
];
export type SerovalWKSymbolNode = [
  type: SerovalNodeType.WKSymbol,
  id: number,
  value: Symbols,
];

// Operations
export type SerovalObjectAssignNode = [
  type: SerovalNodeType.ObjectAssign,
  id: number,
  // value ref
  index: number,
  // value ref
  value: number,
];
export type SerovalArrayAssignNode = [
  type: SerovalNodeType.ArrayAssign,
  id: number,
  index: number,
  // value ref
  value: number,
];
export type SerovalAddNode = [
  type: SerovalNodeType.Add,
  id: number,
  // value ref
  value: number,
];
export type SerovalThrowNode = [
  type: SerovalNodeType.Throw,
  id: number,
  // value ref
  value: number,
];
export type SerovalReturnNode = [
  type: SerovalNodeType.Return,
  id: number,
  // value ref
  value: number,
];
export type SerovalCloseNode = [type: SerovalNodeType.Close, id: number];

export type SerovalArrayNode = [
  type: SerovalNodeType.Array,
  id: number,
  flag: SerovalObjectFlags,
  length: number,
];

export type SerovalStreamNode = [type: SerovalNodeType.Stream, id: number];
export type SerovalSequenceNode = [
  type: SerovalNodeType.Sequence,
  id: number,
  throwsAt: number,
  doneAt: number,
];
export type SerovalObjectNode = [
  type: SerovalNodeType.Object,
  id: number,
  flag: SerovalObjectFlags,
];
export type SerovalNullConstructorNode = [
  type: SerovalNodeType.NullConstructor,
  id: number,
  flag: SerovalObjectFlags,
];

export type SerovalDateNode = [
  type: SerovalNodeType.Date,
  id: number,
  value: number,
];

export type SerovalErrorNode = [
  type: SerovalNodeType.Error,
  id: number,
  constructor: ErrorConstructorTag,
  // string reference
  message: number,
];

export type SerovalBoxedNode = [
  type: SerovalNodeType.Boxed,
  id: number,
  // boxed value reference
  value: number,
];

export type SerovalArrayBufferNode = [
  type: SerovalNodeType.ArrayBuffer,
  id: number,
  bytes: Uint8Array,
];

export type SerovalTypedArrayNode = [
  type: SerovalNodeType.TypedArray,
  id: number,
  constructor: TypedArrayTag,
  offset: number,
  length: number,
  // ArrayBuffer reference
  buffer: number,
];

export type SerovalBigIntTypedArrayNode = [
  type: SerovalNodeType.BigIntTypedArray,
  id: number,
  constructor: BigIntTypedArrayTag,
  offset: number,
  length: number,
  // ArrayBuffer reference
  buffer: number,
];

export type SerovalDataViewNode = [
  type: SerovalNodeType.DataView,
  id: number,
  offset: number,
  length: number,
  // ArrayBuffer reference
  buffer: number,
];

export type SerovalMapNode = [type: SerovalNodeType.Map, id: number];
export type SerovalSetNode = [type: SerovalNodeType.Set, id: number];

export type SerovalPromiseNode = [type: SerovalNodeType.Promise, id: number];

export type SerovalRegExpNode = [
  type: SerovalNodeType.RegExp,
  id: number,
  // string ref
  pattern: number,
  // string ref
  flags: number,
];

export type SerovalAggregateErrorNode = [
  type: SerovalNodeType.AggregateError,
  id: number,
  // string ref
  message: number,
];

export type SerovalPluginNode = [
  type: SerovalNodeType.Plugin,
  id: number,
  // string ref,
  tag: number,
  // object ref
  config: number,
];

export type SerovalRootNode = [type: SerovalNodeType.Root, id: number];

export type SerovalNode =
  | SerovalConstantNode
  | SerovalNumberNode
  | SerovalStringNode
  | SerovalBigintNode
  | SerovalWKSymbolNode
  | SerovalObjectAssignNode
  | SerovalArrayAssignNode
  | SerovalAddNode
  | SerovalThrowNode
  | SerovalReturnNode
  | SerovalCloseNode
  | SerovalArrayNode
  | SerovalStreamNode
  | SerovalSequenceNode
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalDateNode
  | SerovalErrorNode
  | SerovalBoxedNode
  | SerovalArrayBufferNode
  | SerovalTypedArrayNode
  | SerovalBigIntTypedArrayNode
  | SerovalDataViewNode
  | SerovalMapNode
  | SerovalSetNode
  | SerovalPromiseNode
  | SerovalRegExpNode
  | SerovalAggregateErrorNode
  | SerovalPluginNode
  | SerovalRootNode;
