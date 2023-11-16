import { describe, it, expect } from 'vitest';
import {
  compileJSON,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  Feature,
  fromJSON,
  serializeAsync,
  toJSONAsync,
} from '../src';

describe('AsyncIterable', () => {
  describe('serializeAsync', () => {
    it('supports AsyncIterables', async () => {
      const example = {
        title: 'Hello World',
        async* [Symbol.asyncIterator](): AsyncIterator<number> {
          await Promise.resolve();
          yield 1;
          yield 2;
          yield 3;
        },
      };
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back.title).toBe(example.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('toJSONAsync', () => {
    it('supports AsyncIterables', async () => {
      const example = {
        title: 'Hello World',
        async* [Symbol.asyncIterator](): AsyncIterator<number> {
          await Promise.resolve();
          yield 1;
          yield 2;
          yield 3;
        },
      };
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
      expect(back.title).toBe(example.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports AsyncIterables', async () => {
      const example = Promise.resolve({
        title: 'Hello World',
        async* [Symbol.asyncIterator]() {
          await Promise.resolve();
          yield 1;
          yield 2;
          yield 3;
        },
      });
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports AsyncIterables', async () => {
        const example = Promise.resolve({
          title: 'Hello World',
          async* [Symbol.asyncIterator]() {
            await Promise.resolve();
            yield 1;
            yield 2;
            yield 3;
          },
        });
        const result = await crossSerializeAsync(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports AsyncIterables', async () => new Promise<void>((done) => {
      const example = Promise.resolve({
        title: 'Hello World',
        async* [Symbol.asyncIterator]() {
          await Promise.resolve();
          yield 1;
          yield 2;
          yield 3;
        },
      });
      crossSerializeStream(example, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports AsyncIterables', async () => new Promise<void>((done) => {
        const example = Promise.resolve({
          title: 'Hello World',
          async* [Symbol.asyncIterator]() {
            await Promise.resolve();
            yield 1;
            yield 2;
            yield 3;
          },
        });
        crossSerializeStream(example, {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
    });
  });
  describe('compat', () => {
    it('should use function expressions instead of arrow functions.', async () => {
      const example = {
        async* [Symbol.asyncIterator](): unknown {
          await Promise.resolve();
          yield example;
        },
      };
      expect(await serializeAsync(example, {
        disabledFeatures: Feature.ArrowFunction,
      })).toMatchSnapshot();
    });
  });
  describe('compat#toJSONAsync', () => {
    it('should use function expression instead of arrow functions.', async () => {
      const example = {
        async* [Symbol.asyncIterator](): unknown {
          await Promise.resolve();
          yield example;
        },
      };
      const result = await toJSONAsync(example, {
        disabledFeatures: Feature.ArrowFunction,
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      expect(compileJSON(result)).toMatchSnapshot();
    });
  });
});
