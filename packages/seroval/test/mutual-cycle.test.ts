import { describe, it, expect } from 'vitest';
import {
  serialize,
  deserialize,
  ServerValue,
  AsyncServerValue,
  serializeAsync,
  fromJSON,
  toJSON,
  toJSONAsync,
} from '../src';

describe('mutual cyclic references', () => {
  describe('serialize', () => {
    it('supports Arrays and Arrays', () => {
      const a: ServerValue[] = [];
      const b: ServerValue[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: ServerValue[] = [];
      const b: Record<string, ServerValue> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, ServerValue> = {};
      const b: Record<string, ServerValue> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('serializeAsync', () => {
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
  describe('toJSON', () => {
    it('supports Arrays and Arrays', () => {
      const a: ServerValue[] = [];
      const b: ServerValue[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: ServerValue[] = [];
      const b: Record<string, ServerValue> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, ServerValue> = {};
      const b: Record<string, ServerValue> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: AsyncServerValue[] = [];
      const b: AsyncServerValue[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Promise<any>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: AsyncServerValue[] = [];
      const b: Record<string, AsyncServerValue> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Promise<any>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, AsyncServerValue> = {};
      const b: Record<string, AsyncServerValue> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b];
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Promise<any>[][]>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
});
