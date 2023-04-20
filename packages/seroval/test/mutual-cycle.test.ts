import { describe, it, expect } from 'vitest';
import {
  serialize,
  deserialize,
  serializeAsync,
  fromJSON,
  toJSON,
  toJSONAsync,
} from '../src';

describe('mutual cyclic references', () => {
  describe('serialize', () => {
    it('supports Arrays and Arrays', () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<unknown[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: unknown[] = [];
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<unknown[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<unknown[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('serializeAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<unknown>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<unknown>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<unknown>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
  describe('toJSON', () => {
    it('supports Arrays and Arrays', () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<unknown[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: unknown[] = [];
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<unknown[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<unknown[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Promise<unknown>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Promise<unknown>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Promise<unknown>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
});
