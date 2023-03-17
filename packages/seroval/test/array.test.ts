import { describe, it, expect } from 'vitest';
import {
  AsyncServerValue,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  ServerValue,
  toJSONAsync,
  toJSON,
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
      const example: ServerValue[] = [];
      example[0] = example;
      example[1] = example;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<ServerValue[]>(result);
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
      const example: AsyncServerValue[] = [];
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
      const example: ServerValue[] = [];
      example[0] = example;
      example[1] = example;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<ServerValue[]>(result);
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
      const example: AsyncServerValue[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
});
describe('array holes', () => {
  describe('serialize', () => {
    it('supports array holes', () => {
      const example = new Array(10);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<undefined[]>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('serializeAsync', () => {
    it('supports array holes', async () => {
      const example = new Array(10);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<undefined[]>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('toJSON', () => {
    it('supports array holes', () => {
      const example = new Array(10);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<undefined[]>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('toJSONAsync', () => {
    it('supports array holes', async () => {
      const example = new Array(10);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<undefined[]>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
});
