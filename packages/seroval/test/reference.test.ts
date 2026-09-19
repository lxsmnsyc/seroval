import { describe, expect, it } from 'vitest';
import {
  createReference,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

const EXAMPLE = createReference('example', () => 'Hello World');

describe('Reference', () => {
  it.each(['', '0', 'quote"\\\n'])(
    'preserves the reference name %j',
    async id => {
      const reference = createReference(id, { value: 1 });
      const source = { first: reference, second: reference };
      const results = [
        deserialize<typeof source>(serialize(source)),
        deserialize<typeof source>(await serializeAsync(source)),
        fromJSON<typeof source>(toJSON(source)),
        fromJSON<typeof source>(await toJSONAsync(source)),
      ];
      for (const result of results) {
        expect(result.first).toBe(reference);
        expect(result.second).toBe(reference);
      }
    },
  );

  it('preserves an existing cross reference with ID zero', () => {
    const value = { value: 1 };
    const node = toCrossJSON(value, {
      refs: new Map<unknown, number>([[value, 0]]),
    });
    expect(
      fromCrossJSON(node, { refs: new Map<number, unknown>([[0, value]]) }),
    ).toBe(value);
  });

  describe('serialize', () => {
    it('supports Reference', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('serializeAsync', () => {
    it('supports Reference', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toJSON', () => {
    it('supports Reference', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Reference', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('crossSerialize', () => {
    it('supports Reference', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('crossSerialize', () => {
      it('supports Reference', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Reference', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Reference', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Reference', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    describe('scoped', () => {
      it('supports Reference', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(EXAMPLE), {
            scopeId: 'example',
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          });
        }));
    });
  });
  describe('toCrossJSON', () => {
    it('supports Reference', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Reference', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Reference', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(EXAMPLE), {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
  });
});
