export const enum Symbols {
  AsyncIterator,
  HasInstance,
  IsConcatSpreadable,
  Iterator,
  Match,
  MatchAll,
  Replace,
  Search,
  Species,
  Split,
  ToPrimitive,
  ToStringTag,
  Unscopables
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
