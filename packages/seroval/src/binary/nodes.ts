import type {
  BigIntTypedArrayTag,
  ErrorConstructorTag,
  SerovalConstant,
  SerovalObjectFlags,
  SerovalTemporalType,
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
  Pending = 38,
  Temporal = 39,
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
  [SerovalBinaryType.Pending]: 'Pending',
  [SerovalBinaryType.Temporal]: 'Temporal',
};

export const enum SerovalEndianness {
  LE = 1,
  BE = 2,
}

export type SerovalNodeMap = {
  [SerovalBinaryType.Preamble]: [
    type: SerovalBinaryType.Preamble,
    endianness: SerovalEndianness,
  ];
  [SerovalBinaryType.Plugin]: [
    type: SerovalBinaryType.Plugin,
    id: Uint8Array,
    // string ref,
    tag: Uint8Array,
    // object ref
    config: Uint8Array,
  ];
  [SerovalBinaryType.Root]: [type: SerovalBinaryType.Root, id: Uint8Array];
  [SerovalBinaryType.Pending]: [
    type: SerovalBinaryType.Pending,
    id: Uint8Array,
    amount: Uint8Array,
  ];

  [SerovalBinaryType.Constant]: [
    type: SerovalBinaryType.Constant,
    id: Uint8Array,
    value: SerovalConstant,
  ];
  [SerovalBinaryType.Number]: [
    type: SerovalBinaryType.Number,
    id: Uint8Array,
    value: Uint8Array,
  ];
  [SerovalBinaryType.String]: [
    type: SerovalBinaryType.String,
    id: Uint8Array,
    length: Uint8Array,
    value: Uint8Array,
  ];
  [SerovalBinaryType.BigInt]: [
    type: SerovalBinaryType.BigInt,
    id: Uint8Array,
    isNegative: number,
    // value ref
    value: Uint8Array,
  ];
  [SerovalBinaryType.WKSymbol]: [
    type: SerovalBinaryType.WKSymbol,
    id: Uint8Array,
    value: Symbols,
  ];

  // Operations
  [SerovalBinaryType.ObjectFlag]: [
    type: SerovalBinaryType.ObjectFlag,
    id: Uint8Array,
    state: SerovalObjectFlags,
  ];
  [SerovalBinaryType.ObjectAssign]: [
    type: SerovalBinaryType.ObjectAssign,
    id: Uint8Array,
    // value ref
    index: Uint8Array,
    // value ref
    value: Uint8Array,
  ];
  [SerovalBinaryType.ArrayAssign]: [
    type: SerovalBinaryType.ArrayAssign,
    id: Uint8Array,
    index: Uint8Array,
    // value ref
    value: Uint8Array,
  ];

  [SerovalBinaryType.Array]: [
    type: SerovalBinaryType.Array,
    id: Uint8Array,
    length: Uint8Array,
  ];

  [SerovalBinaryType.Stream]: [type: SerovalBinaryType.Stream, id: Uint8Array];
  [SerovalBinaryType.StreamNext]: [
    type: SerovalBinaryType.StreamNext,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];
  [SerovalBinaryType.StreamThrow]: [
    type: SerovalBinaryType.StreamThrow,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];
  [SerovalBinaryType.StreamReturn]: [
    type: SerovalBinaryType.StreamReturn,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];

  [SerovalBinaryType.Sequence]: [
    type: SerovalBinaryType.Sequence,
    id: Uint8Array,
    throwsAt: Uint8Array,
    doneAt: Uint8Array,
  ];
  [SerovalBinaryType.SequencePush]: [
    type: SerovalBinaryType.SequencePush,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];

  [SerovalBinaryType.Object]: [type: SerovalBinaryType.Object, id: Uint8Array];
  [SerovalBinaryType.NullConstructor]: [
    type: SerovalBinaryType.NullConstructor,
    id: Uint8Array,
  ];

  [SerovalBinaryType.Date]: [
    type: SerovalBinaryType.Date,
    id: Uint8Array,
    value: Uint8Array,
  ];
  [SerovalBinaryType.Error]: [
    type: SerovalBinaryType.Error,
    id: Uint8Array,
    constructor: ErrorConstructorTag,
    // string reference
    message: Uint8Array,
  ];
  [SerovalBinaryType.Boxed]: [
    type: SerovalBinaryType.Boxed,
    id: Uint8Array,
    // boxed value reference
    value: Uint8Array,
  ];
  [SerovalBinaryType.ArrayBuffer]: [
    type: SerovalBinaryType.ArrayBuffer,
    id: Uint8Array,
    length: Uint8Array,
    bytes: Uint8Array,
  ];
  [SerovalBinaryType.TypedArray]: [
    type: SerovalBinaryType.TypedArray,
    id: Uint8Array,
    constructor: TypedArrayTag,
    // ArrayBuffer reference
    buffer: Uint8Array,
    offset: Uint8Array,
    length: Uint8Array,
  ];
  [SerovalBinaryType.BigIntTypedArray]: [
    type: SerovalBinaryType.BigIntTypedArray,
    id: Uint8Array,
    constructor: BigIntTypedArrayTag,
    // ArrayBuffer reference
    buffer: Uint8Array,
    offset: Uint8Array,
    length: Uint8Array,
  ];
  [SerovalBinaryType.DataView]: [
    type: SerovalBinaryType.DataView,
    id: Uint8Array,
    // ArrayBuffer reference
    buffer: Uint8Array,
    offset: Uint8Array,
    length: Uint8Array,
  ];

  [SerovalBinaryType.Map]: [type: SerovalBinaryType.Map, id: Uint8Array];
  [SerovalBinaryType.MapSet]: [
    type: SerovalBinaryType.MapSet,
    id: Uint8Array,
    // index ref
    index: Uint8Array,
    // value ref
    value: Uint8Array,
  ];

  [SerovalBinaryType.Set]: [type: SerovalBinaryType.Set, id: Uint8Array];
  [SerovalBinaryType.SetAdd]: [
    type: SerovalBinaryType.SetAdd,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];

  [SerovalBinaryType.Promise]: [
    type: SerovalBinaryType.Promise,
    id: Uint8Array,
  ];
  [SerovalBinaryType.PromiseSuccess]: [
    type: SerovalBinaryType.PromiseSuccess,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];
  [SerovalBinaryType.PromiseFailure]: [
    type: SerovalBinaryType.PromiseFailure,
    id: Uint8Array,
    // value ref
    value: Uint8Array,
  ];

  [SerovalBinaryType.RegExp]: [
    type: SerovalBinaryType.RegExp,
    id: Uint8Array,
    // string ref
    pattern: Uint8Array,
    // string ref
    flags: Uint8Array,
  ];
  [SerovalBinaryType.AggregateError]: [
    type: SerovalBinaryType.AggregateError,
    id: Uint8Array,
    // string ref
    message: Uint8Array,
  ];

  [SerovalBinaryType.Iterator]: [
    type: SerovalBinaryType.Iterator,
    id: Uint8Array,
    sequence: Uint8Array,
  ];
  [SerovalBinaryType.AsyncIterator]: [
    type: SerovalBinaryType.AsyncIterator,
    id: Uint8Array,
    stream: Uint8Array,
  ];

  [SerovalBinaryType.Temporal]: [
    type: SerovalBinaryType.Temporal,
    id: Uint8Array,
    type: SerovalTemporalType,
    // string ref
    iso: Uint8Array,
  ];
};

export type SerovalNode = SerovalNodeMap[keyof SerovalNodeMap];
