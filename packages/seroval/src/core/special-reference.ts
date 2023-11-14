import { createEffectfulFunction, createFunction } from './function-string';
// These represents special references that are not provided
// by the user but are accessed by the serial output
export const enum SpecialReference {
  // A sentinel ref is used to allow recursive Map
  // assignments to be serialized in their original
  // sequence. The sentinel ref is used as a placeholder
  // value
  Sentinel = 0,
  // A factory for creating iterators
  Iterator = 1,
  SymbolIterator = 2,
}

const SENTINEL_REF: never[] = [];
const ITERATOR_REF: never[] = [];

export function getSpecialReferenceSource(features: number, ref: SpecialReference): unknown {
  switch (ref) {
    case SpecialReference.Sentinel:
      return SENTINEL_REF;
    case SpecialReference.Iterator:
      return ITERATOR_REF;
    case SpecialReference.SymbolIterator:
      return Symbol.iterator;
    default:
      throw new Error('unknown special reference ' + ref);
  }
}

export function getSpecialReferenceValue(features: number, ref: SpecialReference): string {
  switch (ref) {
    case SpecialReference.Sentinel:
      return '[]';
    case SpecialReference.Iterator:
      return createFunction(
        features,
        ['s'],
        '(' + createFunction(
          features,
          ['i', 'c', 'd'],
          '(i=0,{next:' + createEffectfulFunction(features, [], 'c=i++,d=s.v[c];if(c===s.t)throw d;return{done:c===s.d,value:d}') + '})',
        ) + ')',
      );
    case SpecialReference.SymbolIterator:
      return 'Symbol.iterator';
    default:
      return '';
  }
}
