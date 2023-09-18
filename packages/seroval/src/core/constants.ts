import type { SerovalConstantNode } from './types';

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
  PromiseConstructor = 28,
  PromiseResolve = 29,
  PromiseReject = 30,
  ReadableStreamConstructor = 31,
  ReadableStreamEnqueue = 32,
  ReadableStreamClose = 33,
  ReadableStreamError = 34,
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

export const INV_SYMBOL_REF = {
  [Symbol.asyncIterator]: Symbols.AsyncIterator,
  [Symbol.hasInstance]: Symbols.HasInstance,
  [Symbol.isConcatSpreadable]: Symbols.IsConcatSpreadable,
  [Symbol.iterator]: Symbols.Iterator,
  [Symbol.match]: Symbols.Match,
  [Symbol.matchAll]: Symbols.MatchAll,
  [Symbol.replace]: Symbols.Replace,
  [Symbol.search]: Symbols.Search,
  [Symbol.species]: Symbols.Species,
  [Symbol.split]: Symbols.Split,
  [Symbol.toPrimitive]: Symbols.ToPrimitive,
  [Symbol.toStringTag]: Symbols.ToStringTag,
  [Symbol.unscopables]: Symbols.Unscopables,
};

export type WellKnownSymbols = keyof typeof INV_SYMBOL_REF;

export const SYMBOL_REF: Record<Symbols, WellKnownSymbols> = {
  [Symbols.AsyncIterator]: Symbol.asyncIterator,
  [Symbols.HasInstance]: Symbol.hasInstance,
  [Symbols.IsConcatSpreadable]: Symbol.isConcatSpreadable,
  [Symbols.Iterator]: Symbol.iterator,
  [Symbols.Match]: Symbol.match,
  [Symbols.MatchAll]: Symbol.matchAll,
  [Symbols.Replace]: Symbol.replace,
  [Symbols.Search]: Symbol.search,
  [Symbols.Species]: Symbol.species,
  [Symbols.Split]: Symbol.split,
  [Symbols.ToPrimitive]: Symbol.toPrimitive,
  [Symbols.ToStringTag]: Symbol.toStringTag,
  [Symbols.Unscopables]: Symbol.unscopables,
};

export function serializeConstant(node: SerovalConstantNode): string {
  switch (node.s) {
    case SerovalConstant.True:
      return '!0';
    case SerovalConstant.False:
      return '!1';
    case SerovalConstant.Undefined:
      return 'void 0';
    case SerovalConstant.Null:
      return 'null';
    case SerovalConstant.NegativeZero:
      return '-0';
    case SerovalConstant.Infinity:
      return '1/0';
    case SerovalConstant.NegativeInfinity:
      return '-1/0';
    case SerovalConstant.NaN:
      return 'NaN';
    default:
      throw new Error('invariant');
  }
}

export function deserializeConstant(node: SerovalConstantNode): unknown {
  switch (node.s) {
    case SerovalConstant.True:
      return true;
    case SerovalConstant.False:
      return false;
    case SerovalConstant.Undefined:
      return undefined;
    case SerovalConstant.Null:
      return null;
    case SerovalConstant.NegativeZero:
      return -0;
    case SerovalConstant.Infinity:
      return Infinity;
    case SerovalConstant.NegativeInfinity:
      return -Infinity;
    case SerovalConstant.NaN:
      return NaN;
    default:
      throw new Error('invariant');
  }
}
