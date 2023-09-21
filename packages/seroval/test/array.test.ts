import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
  crossSerialize,
  crossSerializeAsync,
} from '../src';

describe('arrays', () => {
  describe('serialize', () => {
    it('supports Arrays', () => {
      const example = [1, 2, 3];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<number[]>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
    });
    it('supports self recursion', () => {
      const example: unknown[] = [];
      example[0] = example;
      example[1] = example;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<unknown[]>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Arrays', async () => {
      const example = [1, 2, 3];
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<number[]>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
    });
    it('supports self recursion', async () => {
      const example: Promise<unknown>[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('toJSON', () => {
    it('supports Arrays', () => {
      const example = [1, 2, 3];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<number[]>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
    });
    it('supports self recursion', () => {
      const example: unknown[] = [];
      example[0] = example;
      example[1] = example;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<unknown[]>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Arrays', async () => {
      const example = [1, 2, 3];
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<number[]>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
    });
    it('supports self recursion', async () => {
      const example: Promise<unknown>[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('crossSerialize', () => {
    it('supports Arrays', () => {
      const example = [1, 2, 3];
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<number[]>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
    });
    it('supports self recursion', () => {
      const example: unknown[] = [];
      example[0] = example;
      example[1] = example;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<unknown[]>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Arrays', async () => {
      const example = [1, 2, 3];
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<number[]>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
    });
    it('supports self recursion', async () => {
      const example: Promise<unknown>[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
});
