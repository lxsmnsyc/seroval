/* eslint-disable no-await-in-loop */
import { describe, it, expect } from 'vitest';
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

const EXAMPLE = new Map([[1, 2], [3, 4]]);
const RECURSIVE = new Map<unknown, unknown>();
RECURSIVE.set(RECURSIVE, RECURSIVE);

const ASYNC_RECURSIVE = new Map<Promise<unknown>, Promise<unknown>>();
ASYNC_RECURSIVE.set(Promise.resolve(ASYNC_RECURSIVE), Promise.resolve(ASYNC_RECURSIVE));

describe('Map', () => {
  describe('serialize', () => {
    it('supports Map', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', () => {
      const result = serialize(RECURSIVE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Map', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await serializeAsync(ASYNC_RECURSIVE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof ASYNC_RECURSIVE>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('toJSON', () => {
    it('supports Map', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', () => {
      const result = toJSON(RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Map', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await toJSONAsync(ASYNC_RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ASYNC_RECURSIVE>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports Map', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', () => {
      const result = crossSerialize(RECURSIVE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Map', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', () => {
        const result = crossSerialize(RECURSIVE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Map', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', async () => {
      const result = await crossSerializeAsync(ASYNC_RECURSIVE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Map', async () => {
        const result = await crossSerializeAsync(
          Promise.resolve(EXAMPLE),
          { scopeId: 'example' },
        );
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Map', async () => new Promise<void>((resolve, reject) => {
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
    it('supports self-recursion', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(ASYNC_RECURSIVE, {
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
      it('supports Map', async () => new Promise<void>((resolve, reject) => {
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
      it('supports self-recursion', async () => new Promise<void>((resolve, reject) => {
        crossSerializeStream(ASYNC_RECURSIVE, {
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
    it('supports Map', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', () => {
      const result = toCrossJSON(RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof RECURSIVE>(result, {
        refs: new Map(),
      });
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Map', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await toCrossJSONAsync(ASYNC_RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof ASYNC_RECURSIVE>(result, {
        refs: new Map(),
      });
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Map', async () => new Promise<void>((resolve, reject) => {
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
    it('supports self-recursion', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(ASYNC_RECURSIVE, {
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
