import { describe, expect, it } from 'vitest';
import {
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSONAsync,
} from '../src';

const EXAMPLE = {
  title: 'Hello World',
  async *[Symbol.asyncIterator](): AsyncIterator<number> {
    await Promise.resolve();
    yield 1;
    yield 2;
    yield 3;
  },
};

describe('AsyncIterable', () => {
  describe('serializeAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await serializeAsync(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('toJSONAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await toJSONAsync(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await crossSerializeAsync(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports AsyncIterables', async () => {
        const result = await crossSerializeAsync(EXAMPLE, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports AsyncIterables', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(EXAMPLE, {
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
      it('supports AsyncIterables', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(EXAMPLE, {
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
  describe('toCrossJSONAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await toCrossJSONAsync(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports AsyncIterables', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(EXAMPLE, {
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
