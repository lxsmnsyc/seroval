import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('sealed object', () => {
  describe('serialize', () => {
    it('supports Objects', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      Object.seal(example);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', () => {
      const example = {} as Record<string, unknown>;
      example.a = example;
      example.b = example;
      Object.seal(example);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, unknown>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const example = ({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>;
      Object.seal(example);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Iterable<number>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('serializeAsync', () => {
    it('supports Objects', async () => {
      const example = Promise.resolve(Object.seal({ hello: 'world' }) as { hello: string });
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Record<string, string>>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe((await example).hello);
    });
    it('supports self-recursion', async () => {
      const example = {} as Record<string, Promise<unknown>>;
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      Object.seal(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, Promise<unknown>>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const example = Promise.resolve(Object.seal({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Iterable<number>>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSON', () => {
    it('supports Objects', () => {
      const example = Object.seal({ hello: 'world' }) as { hello: string };
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, string>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', () => {
      const example = {} as Record<string, unknown>;
      example.a = example;
      example.b = example;
      Object.seal(example);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, unknown>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const example = ({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>;
      Object.seal(example);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Iterable<number>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Objects', async () => {
      const example = Promise.resolve(Object.seal({ hello: 'world' }) as { hello: string });
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Record<string, string>>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe((await example).hello);
    });
    it('supports self-recursion', async () => {
      const example = {} as Record<string, Promise<unknown>>;
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      Object.seal(example);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, Promise<unknown>>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const example = Promise.resolve(Object.seal({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Iterable<number>>>(result);
      expect(Object.isSealed(back)).toBe(true);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
});
