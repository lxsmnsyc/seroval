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

const EXAMPLE = {
  title: 'Hello World',
  *[Symbol.iterator](): Generator<number> {
    yield 1;
    yield 2;
    yield 3;
  },
};

describe('Iterable', () => {
  describe('serialize', () => {
    it('supports Iterables', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('serializeAsync', () => {
    it('supports Iterables', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toJSON', () => {
    it('supports Iterables', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Iterables', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('crossSerialize', () => {
    it('supports Iterables', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Iterables', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Iterables', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Iterables', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Iterables', async () =>
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
      it('supports Iterables', async () =>
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
    it('supports Iterables', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Iterables', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Iterables', async () =>
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
