import { describe, expect, it } from 'vitest';
import { Feature } from '../src';
import { ALL_ENABLED, FeatureFlag } from '../src/core/compat';

describe('Feature', () => {
  it('exposes the same bits the library uses internally', () => {
    expect(Feature.AggregateError).toBe(FeatureFlag.AggregateError);
    expect(Feature.ArrowFunction).toBe(FeatureFlag.ArrowFunction);
    expect(Feature.ErrorPrototypeStack).toBe(FeatureFlag.ErrorPrototypeStack);
    expect(Feature.ObjectAssign).toBe(FeatureFlag.ObjectAssign);
    expect(Feature.BigIntTypedArray).toBe(FeatureFlag.BigIntTypedArray);
    expect(Feature.RegExp).toBe(FeatureFlag.RegExp);
    expect(Feature.Temporal).toBe(FeatureFlag.Temporal);
  });
  it('covers every bit in ALL_ENABLED', () => {
    let all = 0;
    for (const bit of Object.values(Feature)) {
      all |= bit;
    }
    expect(all).toBe(ALL_ENABLED);
  });
});
