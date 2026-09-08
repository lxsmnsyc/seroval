import { describe, expect, it } from 'vitest';
import {
  fromCrossJSON,
  fromJSON,
  SerovalMalformedNodeError,
  toCrossJSON,
  toJSON,
} from '../src';

describe('array node validation', () => {
  it.each([null, {}, { length: 0 }, { length: 1000000 }, 'not an array'])(
    'rejects non-array items %j in both JSON formats',
    items => {
      const node = JSON.parse(JSON.stringify({ ...toCrossJSON([]), a: items }));
      const expected = expect.objectContaining({
        cause: expect.any(SerovalMalformedNodeError),
      });
      expect(() => fromJSON({ ...toJSON([]), t: node })).toThrow(expected);
      expect(() => fromCrossJSON(node, { refs: new Map() })).toThrow(expected);
    },
  );

  it('rejects a non-array before reading its declared length', () => {
    const node = {
      ...toCrossJSON([]),
      a: {
        get length() {
          throw new Error('length must not be read');
        },
      },
    };
    expect(() =>
      fromCrossJSON(node as unknown as ReturnType<typeof toCrossJSON>, {
        refs: new Map(),
      }),
    ).toThrow(
      expect.objectContaining({ cause: expect.any(SerovalMalformedNodeError) }),
    );
  });

  it.each([{ value: [] }, { value: [1, 2] }, { value: new Array(3) }])(
    'preserves valid arrays $value',
    ({ value }) => {
      expect(fromJSON(toJSON(value))).toStrictEqual(value);
      expect(
        fromCrossJSON(toCrossJSON(value), { refs: new Map() }),
      ).toStrictEqual(value);
    },
  );
});
