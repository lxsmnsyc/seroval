import { SerovalUnknownTypedArrayError } from './errors';
import {
  SYM_ASYNC_ITERATOR,
  SYM_HAS_INSTANCE,
  SYM_IS_CONCAT_SPREADABLE,
  SYM_ITERATOR,
  SYM_MATCH,
  SYM_MATCH_ALL,
  SYM_REPLACE,
  SYM_SEARCH,
  SYM_SPECIES,
  SYM_SPLIT,
  SYM_TO_PRIMITIVE,
  SYM_TO_STRING_TAG,
  SYM_UNSCOPABLES,
} from './symbols';

export const enum SerovalConstant {
  Null = 0,
  Undefined = 1,
  True = 2,
  False = 3,
  NegZero = 4,
  Inf = 5,
  NegInf = 6,
  Nan = 7,
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
  Reference = 18,
  ArrayBuffer = 19,
  DataView = 20,
  Boxed = 21,
  PromiseConstructor = 22,
  PromiseSuccess = 23,
  PromiseFailure = 24,
  Plugin = 25,
  SpecialReference = 26,
  IteratorFactory = 27,
  IteratorFactoryInstance = 28,
  AsyncIteratorFactory = 29,
  AsyncIteratorFactoryInstance = 30,
  StreamConstructor = 31,
  StreamNext = 32,
  StreamThrow = 33,
  StreamReturn = 34,
  Sequence = 35,
}

export const enum SerovalObjectFlags {
  None = 0,
  NonExtensible = 1,
  Sealed = 2,
  Frozen = 3,
}

export const enum Symbols {
  AsyncIterator = 0,
  HasInstance = 1,
  IsConcatSpreadable = 2,
  Iterator = 3,
  Match = 4,
  MatchAll = 5,
  Replace = 6,
  Search = 7,
  Species = 8,
  Split = 9,
  ToPrimitive = 10,
  ToStringTag = 11,
  Unscopables = 12,
}

export const SYMBOL_STRING: Record<Symbols, string> = {
  [Symbols.AsyncIterator]: 'Symbol.asyncIterator',
  [Symbols.HasInstance]: 'Symbol.hasInstance',
  [Symbols.IsConcatSpreadable]: 'Symbol.isConcatSpreadable',
  [Symbols.Iterator]: 'Symbol.iterator',
  [Symbols.Match]: 'Symbol.match',
  [Symbols.MatchAll]: 'Symbol.matchAll',
  [Symbols.Replace]: 'Symbol.replace',
  [Symbols.Search]: 'Symbol.search',
  [Symbols.Species]: 'Symbol.species',
  [Symbols.Split]: 'Symbol.split',
  [Symbols.ToPrimitive]: 'Symbol.toPrimitive',
  [Symbols.ToStringTag]: 'Symbol.toStringTag',
  [Symbols.Unscopables]: 'Symbol.unscopables',
};

export const INV_SYMBOL_REF = /* @__PURE__ */ {
  [SYM_ASYNC_ITERATOR]: Symbols.AsyncIterator,
  [SYM_HAS_INSTANCE]: Symbols.HasInstance,
  [SYM_IS_CONCAT_SPREADABLE]: Symbols.IsConcatSpreadable,
  [SYM_ITERATOR]: Symbols.Iterator,
  [SYM_MATCH]: Symbols.Match,
  [SYM_MATCH_ALL]: Symbols.MatchAll,
  [SYM_REPLACE]: Symbols.Replace,
  [SYM_SEARCH]: Symbols.Search,
  [SYM_SPECIES]: Symbols.Species,
  [SYM_SPLIT]: Symbols.Split,
  [SYM_TO_PRIMITIVE]: Symbols.ToPrimitive,
  [SYM_TO_STRING_TAG]: Symbols.ToStringTag,
  [SYM_UNSCOPABLES]: Symbols.Unscopables,
};

export type WellKnownSymbols = keyof typeof INV_SYMBOL_REF;

export const SYMBOL_REF: Record<Symbols, WellKnownSymbols> = {
  [Symbols.AsyncIterator]: SYM_ASYNC_ITERATOR,
  [Symbols.HasInstance]: SYM_HAS_INSTANCE,
  [Symbols.IsConcatSpreadable]: SYM_IS_CONCAT_SPREADABLE,
  [Symbols.Iterator]: SYM_ITERATOR,
  [Symbols.Match]: SYM_MATCH,
  [Symbols.MatchAll]: SYM_MATCH_ALL,
  [Symbols.Replace]: SYM_REPLACE,
  [Symbols.Search]: SYM_SEARCH,
  [Symbols.Species]: SYM_SPECIES,
  [Symbols.Split]: SYM_SPLIT,
  [Symbols.ToPrimitive]: SYM_TO_PRIMITIVE,
  [Symbols.ToStringTag]: SYM_TO_STRING_TAG,
  [Symbols.Unscopables]: SYM_UNSCOPABLES,
};

export const CONSTANT_STRING: Record<SerovalConstant, string> = {
  [SerovalConstant.True]: '!0',
  [SerovalConstant.False]: '!1',
  [SerovalConstant.Undefined]: 'void 0',
  [SerovalConstant.Null]: 'null',
  [SerovalConstant.NegZero]: '-0',
  [SerovalConstant.Inf]: '1/0',
  [SerovalConstant.NegInf]: '-1/0',
  [SerovalConstant.Nan]: '0/0',
};

export const NIL = void 0;

export const CONSTANT_VAL: Record<SerovalConstant, unknown> = {
  [SerovalConstant.True]: true,
  [SerovalConstant.False]: false,
  [SerovalConstant.Undefined]: NIL,
  [SerovalConstant.Null]: null,
  [SerovalConstant.NegZero]: -0,
  [SerovalConstant.Inf]: Number.POSITIVE_INFINITY,
  [SerovalConstant.NegInf]: Number.NEGATIVE_INFINITY,
  [SerovalConstant.Nan]: Number.NaN,
};

export const enum ErrorConstructorTag {
  Error = 0,
  EvalError = 1,
  RangeError = 2,
  ReferenceError = 3,
  SyntaxError = 4,
  TypeError = 5,
  URIError = 6,
}

export const ERROR_CONSTRUCTOR_STRING: Record<ErrorConstructorTag, string> = {
  [ErrorConstructorTag.Error]: 'Error',
  [ErrorConstructorTag.EvalError]: 'EvalError',
  [ErrorConstructorTag.RangeError]: 'RangeError',
  [ErrorConstructorTag.ReferenceError]: 'ReferenceError',
  [ErrorConstructorTag.SyntaxError]: 'SyntaxError',
  [ErrorConstructorTag.TypeError]: 'TypeError',
  [ErrorConstructorTag.URIError]: 'URIError',
};

type ErrorConstructors =
  | ErrorConstructor
  | EvalErrorConstructor
  | RangeErrorConstructor
  | ReferenceErrorConstructor
  | SyntaxErrorConstructor
  | TypeErrorConstructor
  | URIErrorConstructor;

export const ERROR_CONSTRUCTOR: Record<ErrorConstructorTag, ErrorConstructors> =
  {
    [ErrorConstructorTag.Error]: Error,
    [ErrorConstructorTag.EvalError]: EvalError,
    [ErrorConstructorTag.RangeError]: RangeError,
    [ErrorConstructorTag.ReferenceError]: ReferenceError,
    [ErrorConstructorTag.SyntaxError]: SyntaxError,
    [ErrorConstructorTag.TypeError]: TypeError,
    [ErrorConstructorTag.URIError]: URIError,
  };

export function isWellKnownSymbol(value: symbol): value is WellKnownSymbols {
  return value in INV_SYMBOL_REF;
}

export const DEFAULT_DEPTH_LIMIT = 64;

export const enum TypedArrayTag {
  Int8Array = 1,
  Int16Array = 2,
  Int32Array = 3,
  Uint8Array = 4,
  Uint16Array = 5,
  Uint32Array = 6,
  Uint8ClampedArray = 7,
  Float32Array = 8,
  Float64Array = 9,
}

export const enum BigIntTypedArrayTag {
  BigInt64Array = 1,
  BigUint64Array = 2,
}

type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor;

type BigIntTypedArrayConstructor =
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

export const TYPED_ARRAY_CONSTRUCTOR: Record<
  TypedArrayTag,
  TypedArrayConstructor
> = {
  [TypedArrayTag.Float32Array]: Float32Array,
  [TypedArrayTag.Float64Array]: Float64Array,
  [TypedArrayTag.Int16Array]: Int16Array,
  [TypedArrayTag.Int32Array]: Int32Array,
  [TypedArrayTag.Int8Array]: Int8Array,
  [TypedArrayTag.Uint16Array]: Uint16Array,
  [TypedArrayTag.Uint32Array]: Uint32Array,
  [TypedArrayTag.Uint8Array]: Uint8Array,
  [TypedArrayTag.Uint8ClampedArray]: Uint8ClampedArray,
};

export const BIG_INT_TYPED_ARRAY_CONSTRUCTOR: Record<
  BigIntTypedArrayTag,
  BigIntTypedArrayConstructor
> = {
  [BigIntTypedArrayTag.BigInt64Array]: BigInt64Array,
  [BigIntTypedArrayTag.BigUint64Array]: BigUint64Array,
};

export type TypedArrayValue =
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;

export type BigIntTypedArrayValue = BigInt64Array | BigUint64Array;

export function getTypedArrayTag(value: TypedArrayValue): TypedArrayTag {
  if (value instanceof Int8Array) {
    return TypedArrayTag.Int8Array;
  }
  if (value instanceof Int16Array) {
    return TypedArrayTag.Int16Array;
  }
  if (value instanceof Int32Array) {
    return TypedArrayTag.Int32Array;
  }
  if (value instanceof Uint8Array) {
    return TypedArrayTag.Uint8Array;
  }
  if (value instanceof Uint16Array) {
    return TypedArrayTag.Uint16Array;
  }
  if (value instanceof Uint32Array) {
    return TypedArrayTag.Uint32Array;
  }
  if (value instanceof Uint8ClampedArray) {
    return TypedArrayTag.Uint8ClampedArray;
  }
  if (value instanceof Float32Array) {
    return TypedArrayTag.Float32Array;
  }
  if (value instanceof Float64Array) {
    return TypedArrayTag.Float64Array;
  }
  throw new SerovalUnknownTypedArrayError();
}

export function getBigIntTypedArrayTag(
  value: BigIntTypedArrayValue,
): BigIntTypedArrayTag {
  if (value instanceof BigInt64Array) {
    return BigIntTypedArrayTag.BigInt64Array;
  }
  if (value instanceof BigUint64Array) {
    return BigIntTypedArrayTag.BigUint64Array;
  }
  throw new SerovalUnknownTypedArrayError();
}
