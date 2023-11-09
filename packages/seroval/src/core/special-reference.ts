
// These represents special references that are not provided

import { createEffectfulFunction, createFunction } from "./function-string";

// by the user but are accessed by the serial output
export const enum SpecialReference {
  // A sentinel ref is used to allow recursive Map
  // assignments to be serialized in their original
  // sequence. The sentinel ref is used as a placeholder
  // value
  Sentinel = 0,
  // A factory for creating iterators
  SymbolIteratorFactory = 1,
}

export type SpecialReferenceState = Record<SpecialReference, 0 | 1 | 2>;

export function createSpecialReferenceState(): SpecialReferenceState {
  return {
    [SpecialReference.Sentinel]: 0,
    [SpecialReference.SymbolIteratorFactory]: 0,
  };
}

export function getSpecialReferenceValue(features: number, ref: SpecialReference): string {
  switch (ref) {
    case SpecialReference.Sentinel:
      return '[]';
    case SpecialReference.SymbolIteratorFactory:
      return createFunction(
        features,
        ['s'],
        '(' + createFunction(
          features,
          ['i', 'c', 'd'],
          '(i=0,{next:' + createEffectfulFunction(features, [], 'c=i++,d=s.v[c];if(c===s.t)throw d;return{done:c===s.d,value:d}') + '})',
        ) + ')',
      );
    default:
      return '';
  }
}
