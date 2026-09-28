import { describe, expect, it, vi } from 'vitest';
import { getCrossReferenceHeader } from '../src';

const REFERENCES_KEY = '__SEROVAL_REFS__';

type GlobalWithStore = typeof globalThis & {
  [REFERENCES_KEY]?: Map<string, unknown>;
};

describe('reference store', () => {
  it('is defined on the first registration instead of on import', async () => {
    vi.resetModules();
    Reflect.deleteProperty(globalThis, REFERENCES_KEY);
    const seroval = await import('../src');
    expect(
      Object.getOwnPropertyDescriptor(globalThis, REFERENCES_KEY),
    ).toBeUndefined();

    const value = { store: true };
    seroval.createReference('reference-store', value);

    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      REFERENCES_KEY,
    );
    expect(descriptor).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: false,
    });
    expect(
      (globalThis as GlobalWithStore)[REFERENCES_KEY]?.get('reference-store'),
    ).toBe(value);
    expect(seroval.deserialize(seroval.serialize(value))).toBe(value);
  });

  it('keeps the cross reference header independent of the store', () => {
    expect(getCrossReferenceHeader()).toBe('self.$R=self.$R||[]');
  });
});
