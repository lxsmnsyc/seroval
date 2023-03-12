import { describe, it, expect } from 'vitest';
import seroval, { deserialize, ServerValue } from '../src';

describe('seroval', () => {
  it('supports booleans', () => {
    expect(seroval(true)).toBe('!0');
    expect(seroval(false)).toBe('!1');
  });
  it('supports numbers', () => {
    const value = Math.random();
    expect(seroval(value)).toBe(`${value}`);
    expect(seroval(NaN)).toBe('NaN');
    expect(seroval(Infinity)).toBe('Infinity');
    expect(seroval(-Infinity)).toBe('-Infinity');
    expect(seroval(-0)).toBe('-0');
  });
  it('supports strings', () => {
    expect(seroval('"hello"')).toMatchSnapshot();
    expect(seroval('<script></script>')).toMatchSnapshot();
    expect(deserialize(seroval('"hello"'))).toBe('"hello"');
    expect(deserialize(seroval('<script></script>'))).toBe('<script></script>');
  });
  it('supports bigint', () => {
    expect(seroval(9007199254740991n)).toMatchSnapshot();
    expect(deserialize(seroval(9007199254740991n))).toBe(9007199254740991n);
  });
  it('supports Arrays', () => {
    const example = [1, 2, 3];
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = deserialize<number[]>(result);
    expect(back).toBeInstanceOf(Array);
    expect(back[0]).toBe(example[0]);
    expect(back[1]).toBe(example[1]);
    expect(back[2]).toBe(example[2]);
  });
  it('supports Objects', () => {
    const example = { hello: 'world' };
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = deserialize<Record<string, string>>(result);
    expect(back).toBeInstanceOf(Object);
    expect(back.hello).toBe(example.hello);
  });
  it('supports Object.create(null)', () => {
    const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = deserialize<Record<string, string>>(result);
    expect(back.constructor).toBeUndefined();
    expect(back.hello).toBe(example.hello);
  });
  it('supports Set', () => {
    const example = new Set([1, 2, 3]);
    const result = seroval(example);
    // expect(result).toMatchSnapshot();
    const back = deserialize<Set<number>>(result);
    expect(back).toBeInstanceOf(Set);
    expect(back.has(1)).toBe(example.has(1));
    expect(back.has(2)).toBe(example.has(2));
    expect(back.has(3)).toBe(example.has(3));
  });
  it('supports Map', () => {
    const example = new Map([[1, 2], [3, 4]]);
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = deserialize<Map<number, number>>(result);
    expect(back).toBeInstanceOf(Map);
    expect(back.get(1)).toBe(example.get(1));
    expect(back.get(3)).toBe(example.get(3));
  });
  it('supports Date', () => {
    const example = new Date();
    const result = seroval(example);
    // expect(result).toMatchSnapshot();
    const back = deserialize<Date>(result);
    expect(back).toBeInstanceOf(Date);
    expect(back.toISOString()).toBe(example.toISOString());
  });
  it('supports RegExp', () => {
    const example = /[a-z0-9]+/i;
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = deserialize<RegExp>(result);
    expect(back).toBeInstanceOf(RegExp);
    expect(String(back)).toBe(String(example));
  });
  it('supports array holes', () => {
    const example = new Array(10);
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = deserialize<ServerValue[]>(result);
    expect(0 in back).toBeFalsy();
    expect(back[0]).toBe(undefined);
    expect(back.length).toBe(example.length);
  });
  describe('Error', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      expect(seroval(a)).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B');
      b.cause = a;
      expect(seroval(b)).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      expect(seroval(a)).toMatchSnapshot();
    });
  });
  describe('self cyclic references', () => {
    it('supports Arrays', () => {
      const example: ServerValue[] = [];
      example[0] = example;
      example[1] = example;
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<ServerValue[]>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
    it('supports Objects', () => {
      const example: Record<string, ServerValue> = {};
      example.a = example;
      example.b = example;
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, ServerValue>>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Maps', () => {
      const example: Map<ServerValue, ServerValue> = new Map();
      example.set(example, example);
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Map<ServerValue, ServerValue>>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
    it('supports Sets', () => {
      const example: Set<ServerValue> = new Set();
      example.add(example);
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Set<ServerValue>>(result);
      expect(back.has(back)).toBe(true);
    });
  });
  describe('mutual cyclic references', () => {
    it('supports Arrays and Arrays', () => {
      const a: ServerValue[] = [];
      const b: ServerValue[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b];
      const result = seroval(example);
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
      const result = seroval(example);
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
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<ServerValue[][]>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
});
