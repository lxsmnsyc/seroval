/* eslint-disable no-await-in-loop */
import { describe, it, expect } from 'vitest';
import { serializeAsync, AsyncServerValue, deserialize } from '../src';

describe('serializeAsync', () => {
  it('supports booleans', async () => {
    expect(await serializeAsync(true)).toBe('!0');
    expect(await serializeAsync(false)).toBe('!1');
  });
  it('supports numbers', async () => {
    const value = Math.random();
    expect(await serializeAsync(Promise.resolve(value))).toBe(`Promise.resolve(${value})`);
    expect(await serializeAsync(Promise.resolve(NaN))).toBe('Promise.resolve(NaN)');
    expect(await serializeAsync(Promise.resolve(Infinity))).toBe('Promise.resolve(Infinity)');
    expect(await serializeAsync(Promise.resolve(-Infinity))).toBe('Promise.resolve(-Infinity)');
    expect(await serializeAsync(Promise.resolve(-0))).toBe('Promise.resolve(-0)');
  });
  it('supports strings', async () => {
    expect(await serializeAsync(Promise.resolve('"hello"'))).toMatchSnapshot();
    expect(await serializeAsync(Promise.resolve('<script></script>'))).toMatchSnapshot();
  });
  it('supports bigint', async () => {
    expect(await serializeAsync(Promise.resolve(9007199254740991n))).toMatchSnapshot();
  });
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
  it('supports Objects', async () => {
    const example = { hello: 'world' };
    const result = await serializeAsync(Promise.resolve(example));
    expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<Record<string, string>>>(result);
    expect(back).toBeInstanceOf(Object);
    expect(back.hello).toBe(example.hello);
  });
  it('supports Object.create(null)', async () => {
    const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
    const result = await serializeAsync(example);
    expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<Record<string, string>>>(result);
    expect(back.constructor).toBeUndefined();
    expect(back.hello).toBe(example.hello);
  });
  it('supports Set', async () => {
    const example = new Set([1, 2, 3]);
    const result = await serializeAsync(Promise.resolve(example));
    expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<Set<number>>>(result);
    expect(back).toBeInstanceOf(Set);
    expect(back.has(1)).toBe(example.has(1));
    expect(back.has(2)).toBe(example.has(2));
    expect(back.has(3)).toBe(example.has(3));
  });
  it('supports Map', async () => {
    const example = new Map([[1, 2], [3, 4]]);
    const result = await serializeAsync(Promise.resolve(example));
    expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<Map<number, number>>>(result);
    expect(back).toBeInstanceOf(Map);
    expect(back.get(1)).toBe(example.get(1));
    expect(back.get(3)).toBe(example.get(3));
  });
  it('supports Date', async () => {
    const example = new Date();
    const result = await serializeAsync(Promise.resolve(example));
    // expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<Date>>(result);
    expect(back).toBeInstanceOf(Date);
    expect(back.toISOString()).toBe(example.toISOString());
  });
  it('supports RegExp', async () => {
    const example = /[a-z0-9]+/i;
    const result = await serializeAsync(Promise.resolve(example));
    expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<RegExp>>(result);
    expect(back).toBeInstanceOf(RegExp);
    expect(String(back)).toBe(String(example));
  });
  it('supports array holes', async () => {
    const example = new Array(10);
    const result = await serializeAsync(Promise.resolve(example));
    expect(result).toMatchSnapshot();
    const back = await deserialize<Promise<any[]>>(result);
    expect(0 in back).toBeFalsy();
    expect(back[0]).toBe(undefined);
    expect(back.length).toBe(example.length);
  });
  describe('Error', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      expect(await serializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B');
      b.cause = Promise.resolve(a);
      expect(await serializeAsync(b)).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      expect(await serializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
  });
  describe('self cyclic references', () => {
    it('supports Arrays', async () => {
      const example: AsyncServerValue[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<any>[]>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
    it('supports Objects', async () => {
      const example: Record<string, AsyncServerValue> = {};
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, Promise<any>>>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Maps', async () => {
      const example: Map<AsyncServerValue, AsyncServerValue> = new Map();
      example.set(Promise.resolve(example), Promise.resolve(example));
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Map<Promise<any>, Promise<any>>>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
    it('supports Sets', async () => {
      const example: Set<AsyncServerValue> = new Set();
      example.add(Promise.resolve(example));
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Set<Promise<any>>>(result);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('mutual cyclic references', () => {
    it('supports Arrays and Arrays', async () => {
      const a: AsyncServerValue[] = [];
      const b: AsyncServerValue[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<any>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: AsyncServerValue[] = [];
      const b: Record<string, AsyncServerValue> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<any>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, AsyncServerValue> = {};
      const b: Record<string, AsyncServerValue> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Promise<any>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
});
