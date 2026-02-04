import type {
  BigIntTypedArrayTag,
  ErrorConstructorTag,
  SerovalConstant,
  SerovalObjectFlags,
  Symbols,
  TypedArrayTag,
} from '../core/constants';

export const enum SerovalBinaryType {
  Preamble = 0,
  Root = 1,
  Constant = 2,
  Number = 3,
  String = 4,
  BigInt = 5,
  WKSymbol = 6,
  ObjectAssign = 7,
  ArrayAssign = 8,
  ObjectFlag = 9,
  Array = 10,
  Stream = 11,
  StreamNext = 12,
  StreamThrow = 13,
  StreamReturn = 14,
  Sequence = 15,
  SequencePush = 16,
  Plugin = 17,
  Object = 18,
  NullConstructor = 19,
  Date = 20,
  Error = 21,
  Boxed = 22,
  ArrayBuffer = 23,
  TypedArray = 24,
  BigIntTypedArray = 25,
  DataView = 26,
  Map = 27,
  MapSet = 28,
  Set = 29,
  SetAdd = 30,
  Promise = 31,
  PromiseSuccess = 32,
  PromiseFailure = 33,
  RegExp = 34,
  AggregateError = 35,
  Iterator = 36,
  AsyncIterator = 37,
}

export const NODE_TYPE_NAME: Record<SerovalBinaryType, string> = {
  [SerovalBinaryType.Preamble]: 'Preamble',
  [SerovalBinaryType.Root]: 'Root',
  [SerovalBinaryType.Constant]: 'Constant',
  [SerovalBinaryType.Number]: 'Number',
  [SerovalBinaryType.String]: 'String',
  [SerovalBinaryType.BigInt]: 'BigInt',
  [SerovalBinaryType.WKSymbol]: 'WKSymbol',
  [SerovalBinaryType.ObjectAssign]: 'ObjectAssign',
  [SerovalBinaryType.ArrayAssign]: 'ArrayAssign',
  [SerovalBinaryType.ObjectFlag]: 'ObjectFlag',
  [SerovalBinaryType.Array]: 'Array',
  [SerovalBinaryType.Stream]: 'Stream',
  [SerovalBinaryType.StreamNext]: 'StreamNext',
  [SerovalBinaryType.StreamThrow]: 'StreamThrow',
  [SerovalBinaryType.StreamReturn]: 'StreamReturn',
  [SerovalBinaryType.Sequence]: 'Sequence',
  [SerovalBinaryType.SequencePush]: 'SequencePush',
  [SerovalBinaryType.Plugin]: 'Plugin',
  [SerovalBinaryType.Object]: 'Object',
  [SerovalBinaryType.NullConstructor]: 'NullConstructor',
  [SerovalBinaryType.Date]: 'Date',
  [SerovalBinaryType.Error]: 'Error',
  [SerovalBinaryType.Boxed]: 'Boxed',
  [SerovalBinaryType.ArrayBuffer]: 'ArrayBuffer',
  [SerovalBinaryType.TypedArray]: 'TypedArray',
  [SerovalBinaryType.BigIntTypedArray]: 'BigIntTypedArray',
  [SerovalBinaryType.DataView]: 'DataView',
  [SerovalBinaryType.Map]: 'Map',
  [SerovalBinaryType.MapSet]: 'MapSet',
  [SerovalBinaryType.Set]: 'Set',
  [SerovalBinaryType.SetAdd]: 'SetAdd',
  [SerovalBinaryType.Promise]: 'Promise',
  [SerovalBinaryType.PromiseSuccess]: 'PromiseSuccess',
  [SerovalBinaryType.PromiseFailure]: 'PromiseFailure',
  [SerovalBinaryType.RegExp]: 'RegExp',
  [SerovalBinaryType.AggregateError]: 'AggregateError',
  [SerovalBinaryType.Iterator]: 'Iterator',
  [SerovalBinaryType.AsyncIterator]: 'AsyncIterator',
};

export const enum SerovalEndianness {
  LE = 1,
  BE = 2,
}

export type SerovalPreambleNode = [
  type: SerovalBinaryType.Preamble,
  endianness: SerovalEndianness,
];

export type SerovalConstantNode = [
  type: SerovalBinaryType.Constant,
  id: Uint8Array,
  value: SerovalConstant,
];
export type SerovalNumberNode = [
  type: SerovalBinaryType.Number,
  id: Uint8Array,
  value: Uint8Array,
];
export type SerovalStringNode = [
  type: SerovalBinaryType.String,
  id: Uint8Array,
  length: Uint8Array,
  value: Uint8Array,
];
export type SerovalBigintNode = [
  type: SerovalBinaryType.BigInt,
  id: Uint8Array,
  isNegative: number,
  // value ref
  value: Uint8Array,
];
export type SerovalWKSymbolNode = [
  type: SerovalBinaryType.WKSymbol,
  id: Uint8Array,
  value: Symbols,
];

export type SerovalObjectFlagNode = [
  type: SerovalBinaryType.ObjectFlag,
  id: Uint8Array,
  state: SerovalObjectFlags,
];

// Operations
export type SerovalObjectAssignNode = [
  type: SerovalBinaryType.ObjectAssign,
  id: Uint8Array,
  // value ref
  index: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalArrayAssignNode = [
  type: SerovalBinaryType.ArrayAssign,
  id: Uint8Array,
  index: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalArrayNode = [
  type: SerovalBinaryType.Array,
  id: Uint8Array,
  length: Uint8Array,
];

export type SerovalStreamNode = [type: SerovalBinaryType.Stream, id: Uint8Array];

export type SerovalStreamNextNode = [
  type: SerovalBinaryType.StreamNext,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalStreamThrowNode = [
  type: SerovalBinaryType.StreamThrow,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalStreamReturnNode = [
  type: SerovalBinaryType.StreamReturn,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalSequenceNode = [
  type: SerovalBinaryType.Sequence,
  id: Uint8Array,
  throwsAt: Uint8Array,
  doneAt: Uint8Array,
];
export type SerovalSequencePushNode = [
  type: SerovalBinaryType.SequencePush,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalObjectNode = [type: SerovalBinaryType.Object, id: Uint8Array];
export type SerovalNullConstructorNode = [
  type: SerovalBinaryType.NullConstructor,
  id: Uint8Array,
];

export type SerovalDateNode = [
  type: SerovalBinaryType.Date,
  id: Uint8Array,
  value: Uint8Array,
];

export type SerovalErrorNode = [
  type: SerovalBinaryType.Error,
  id: Uint8Array,
  constructor: ErrorConstructorTag,
  // string reference
  message: Uint8Array,
];

export type SerovalBoxedNode = [
  type: SerovalBinaryType.Boxed,
  id: Uint8Array,
  // boxed value reference
  value: Uint8Array,
];

export type SerovalArrayBufferNode = [
  type: SerovalBinaryType.ArrayBuffer,
  id: Uint8Array,
  length: Uint8Array,
  bytes: Uint8Array,
];

export type SerovalTypedArrayNode = [
  type: SerovalBinaryType.TypedArray,
  id: Uint8Array,
  constructor: TypedArrayTag,
  offset: Uint8Array,
  length: Uint8Array,
  // ArrayBuffer reference
  buffer: Uint8Array,
];

export type SerovalBigIntTypedArrayNode = [
  type: SerovalBinaryType.BigIntTypedArray,
  id: Uint8Array,
  constructor: BigIntTypedArrayTag,
  offset: Uint8Array,
  length: Uint8Array,
  // ArrayBuffer reference
  buffer: Uint8Array,
];

export type SerovalDataViewNode = [
  type: SerovalBinaryType.DataView,
  id: Uint8Array,
  offset: Uint8Array,
  length: Uint8Array,
  // ArrayBuffer reference
  buffer: Uint8Array,
];

export type SerovalMapNode = [type: SerovalBinaryType.Map, id: Uint8Array];
export type SerovalMapSetNode = [
  type: SerovalBinaryType.MapSet,
  id: Uint8Array,
  // index ref
  index: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalSetNode = [type: SerovalBinaryType.Set, id: Uint8Array];
export type SerovalSetAddNode = [
  type: SerovalBinaryType.SetAdd,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalPromiseNode = [
  type: SerovalBinaryType.Promise,
  id: Uint8Array,
];
export type SerovalPromiseSuccessNode = [
  type: SerovalBinaryType.PromiseSuccess,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];
export type SerovalPromiseFailureNode = [
  type: SerovalBinaryType.PromiseFailure,
  id: Uint8Array,
  // value ref
  value: Uint8Array,
];

export type SerovalRegExpNode = [
  type: SerovalBinaryType.RegExp,
  id: Uint8Array,
  // string ref
  pattern: Uint8Array,
  // string ref
  flags: Uint8Array,
];

export type SerovalAggregateErrorNode = [
  type: SerovalBinaryType.AggregateError,
  id: Uint8Array,
  // string ref
  message: Uint8Array,
];

export type SerovalPluginNode = [
  type: SerovalBinaryType.Plugin,
  id: Uint8Array,
  // string ref,
  tag: Uint8Array,
  // object ref
  config: Uint8Array,
];

export type SerovalRootNode = [type: SerovalBinaryType.Root, id: Uint8Array];

export type SerovalIteratorNode = [
  type: SerovalBinaryType.Iterator,
  id: Uint8Array,
  sequence: Uint8Array,
];
export type SerovalAsyncIteratorNode = [
  type: SerovalBinaryType.AsyncIterator,
  id: Uint8Array,
  stream: Uint8Array,
];

export type SerovalNode =
  | SerovalPreambleNode
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
  | SerovalRootNode
  | SerovalIteratorNode
  | SerovalAsyncIteratorNode;
