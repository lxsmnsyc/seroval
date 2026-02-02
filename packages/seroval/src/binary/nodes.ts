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
  ObjectFlag = 8,
  Array = 9,
  Stream = 10,
  StreamNext = 11,
  StreamThrow = 12,
  StreamReturn = 13,
  Sequence = 14,
  SequencePush = 15,
  Plugin = 16,
  Object = 17,
  NullConstructor = 18,
  Date = 19,
  Error = 20,
  Boxed = 21,
  ArrayBuffer = 22,
  TypedArray = 23,
  BigIntTypedArray = 24,
  DataView = 25,
  Map = 26,
  MapSet = 27,
  Set = 28,
  SetAdd = 29,
  Promise = 30,
  PromiseSuccess = 31,
  PromiseFailure = 32,
  RegExp = 33,
  AggregateError = 34,
}

export type SerovalConstantNode = [
  type: SerovalNodeType.Constant,
  id: Uint8Array,
  value: SerovalConstant,
];
export type SerovalNumberNode = [
  type: SerovalNodeType.Number,
  id: Uint8Array,
  value: Uint8Array,
];
export type SerovalStringNode = [
  type: SerovalNodeType.String,
  id: Uint8Array,
  length: Uint8Array,
  value: Uint8Array,
];
export type SerovalBigintNode = [
  type: SerovalNodeType.BigInt,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalWKSymbolNode = [
  type: SerovalNodeType.WKSymbol,
  id: Uint8Array,
  value: Symbols,
];

export type SerovalObjectFlagNode = [
  type: SerovalNodeType.ObjectFlag,
  id: Uint8Array,
  state: SerovalObjectFlags,
];

// Operations
export type SerovalObjectAssignNode = [
  type: SerovalNodeType.ObjectAssign,
  id: Uint8Array,
  // value ref
  index: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalArrayAssignNode = [
  type: SerovalNodeType.ArrayAssign,
  id: Uint8Array,
  index: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalArrayNode = [
  type: SerovalNodeType.Array,
  id: Uint8Array,
  length: Uint8Array,
];

export type SerovalStreamNode = [type: SerovalNodeType.Stream, id: Uint8Array];

export type SerovalStreamNextNode = [
  type: SerovalNodeType.StreamNext,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalStreamThrowNode = [
  type: SerovalNodeType.StreamThrow,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalStreamReturnNode = [
  type: SerovalNodeType.StreamReturn,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalSequenceNode = [
  type: SerovalNodeType.Sequence,
  id: Uint8Array,
  throwsAt: Uint8Array,
  doneAt: Uint8Array,
];
export type SerovalSequencePushNode = [
  type: SerovalNodeType.SequencePush,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalObjectNode = [type: SerovalNodeType.Object, id: Uint8Array];
export type SerovalNullConstructorNode = [
  type: SerovalNodeType.NullConstructor,
  id: Uint8Array,
];

export type SerovalDateNode = [
  type: SerovalNodeType.Date,
  id: Uint8Array,
  value: Uint8Array,
];

export type SerovalErrorNode = [
  type: SerovalNodeType.Error,
  id: Uint8Array,
  constructor: ErrorConstructorTag,
  // string reference
  message: Uint8Array,
];

export type SerovalBoxedNode = [
  type: SerovalNodeType.Boxed,
  id: Uint8Array,
  // boxed value reference
  value: Uint8Array,
];

export type SerovalArrayBufferNode = [
  type: SerovalNodeType.ArrayBuffer,
  id: Uint8Array,
  length: Uint8Array,
  bytes: Uint8Array,
];

export type SerovalTypedArrayNode = [
  type: SerovalNodeType.TypedArray,
  id: Uint8Array,
  constructor: TypedArrayTag,
  offset: Uint8Array,
  length: Uint8Array,
  // ArrayBuffer reference
  buffer: Uint8Array,
];

export type SerovalBigIntTypedArrayNode = [
  type: SerovalNodeType.BigIntTypedArray,
  id: Uint8Array,
  constructor: BigIntTypedArrayTag,
  offset: Uint8Array,
  length: Uint8Array,
  // ArrayBuffer reference
  buffer: Uint8Array,
];

export type SerovalDataViewNode = [
  type: SerovalNodeType.DataView,
  id: Uint8Array,
  offset: Uint8Array,
  length: Uint8Array,
  // ArrayBuffer reference
  buffer: Uint8Array,
];

export type SerovalMapNode = [type: SerovalNodeType.Map, id: Uint8Array];
export type SerovalMapSetNode = [
  type: SerovalNodeType.MapSet,
  id: Uint8Array,
  // index ref
  index: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalSetNode = [type: SerovalNodeType.Set, id: Uint8Array];
export type SerovalSetAddNode = [
  type: SerovalNodeType.SetAdd,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalPromiseNode = [
  type: SerovalNodeType.Promise,
  id: Uint8Array,
];
export type SerovalPromiseSuccessNode = [
  type: SerovalNodeType.PromiseSuccess,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalPromiseFailureNode = [
  type: SerovalNodeType.PromiseFailure,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalRegExpNode = [
  type: SerovalNodeType.RegExp,
  id: Uint8Array,
  // string ref
  pattern: Uint8Array,
  // string ref
  flags: Uint8Array,
];

export type SerovalAggregateErrorNode = [
  type: SerovalNodeType.AggregateError,
  id: Uint8Array,
  // string ref
  message: Uint8Array,
];

export type SerovalPluginNode = [
  type: SerovalNodeType.Plugin,
  id: Uint8Array,
  // string ref,
  tag: Uint8Array,
  // object ref
  config: Uint8Array,
];

export type SerovalRootNode = [type: SerovalNodeType.Root, id: Uint8Array];

export type SerovalNode =
  | SerovalConstantNode
  | SerovalNumberNode
  | SerovalStringNode
  | SerovalBigintNode
  | SerovalWKSymbolNode
  | SerovalObjectAssignNode
  | SerovalArrayAssignNode
  | SerovalObjectFlagNode
  | SerovalArrayNode
  | SerovalStreamNode
  | SerovalStreamNextNode
  | SerovalStreamThrowNode
  | SerovalStreamReturnNode
  | SerovalSequenceNode
  | SerovalSequencePushNode
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
  | SerovalMapSetNode
  | SerovalSetNode
  | SerovalSetAddNode
  | SerovalPromiseNode
  | SerovalPromiseSuccessNode
  | SerovalPromiseFailureNode
  | SerovalRegExpNode
  | SerovalAggregateErrorNode
  | SerovalPluginNode
  | SerovalRootNode;
