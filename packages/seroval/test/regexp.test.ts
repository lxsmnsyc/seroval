import { describe, expect, it } from 'vitest';
import {
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

const EXAMPLE = /[a-z0-9]+/i;

describe('RegExp', () => {
  describe('serialize', () => {
    it('supports RegExp', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('serializeAsync', () => {
    it('supports RegExp', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSON', () => {
    it('supports RegExp', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports RegExp', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('crossSerialize', () => {
    it('supports RegExp', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports RegExp', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports RegExp', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports RegExp', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports RegExp', async () =>
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
      it('supports RegExp', async () =>
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
    it('supports RegExp', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports RegExp', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports RegExp', async () =>
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
