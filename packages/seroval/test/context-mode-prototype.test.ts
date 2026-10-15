import { describe, expect, it } from 'vitest';
import { fromCrossJSON, fromJSON, toCrossJSON, toJSON } from '../src';

describe('deserializer mode ownership', () => {
  it.each(['value', 'getter'])('ignores an inherited marked %s', (kind) => {
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'marked');
    const property: PropertyDescriptor =
      kind === 'value'
        ? { value: new Set() }
        : {
            get() {
              throw new Error('Inherited marked getter was read');
            },
          };
    // oxlint-disable-next-line eslint/no-extend-native -- the test checks that an inherited property is ignored.
    Object.defineProperty(Object.prototype, 'marked', {
      ...property,
      configurable: true,
    });
    try {
      const shared = { value: 1 };
      const value = [shared, shared];
      const cross = fromCrossJSON<typeof value>(toCrossJSON(value), {});
      const vanilla = fromJSON<typeof value>(toJSON(value));
      expect(cross).toEqual(value);
      expect(cross[0]).toBe(cross[1]);
      expect(vanilla).toEqual(value);
      expect(vanilla[0]).toBe(vanilla[1]);
    } finally {
      if (previous) {
        // oxlint-disable-next-line eslint/no-extend-native -- restores the original descriptor.
        Object.defineProperty(Object.prototype, 'marked', previous);
      } else {
        Reflect.deleteProperty(Object.prototype, 'marked');
      }
    }
  });
});
