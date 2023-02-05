/* eslint-disable no-eval */
import { describe, it, expect } from 'vitest';
import seroval, { ServerValue } from '../src';

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
    expect(eval(seroval('"hello"'))).toBe('"hello"');
    expect(eval(seroval('<script></script>'))).toBe('<script></script>');
  });
  it('supports bigint', () => {
    expect(seroval(9007199254740991n)).toMatchSnapshot();
    expect(eval(seroval(9007199254740991n))).toBe(9007199254740991n);
  });
  it('supports Arrays', () => {
    const example = [1, 2, 3];
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = eval(result) as number[];
    expect(back).toBeInstanceOf(Array);
    expect(back[0]).toBe(example[0]);
    expect(back[1]).toBe(example[1]);
    expect(back[2]).toBe(example[2]);
  });
  it('supports Objects', () => {
    const example = { hello: 'world' };
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = eval(result) as Record<string, string>;
    expect(back).toBeInstanceOf(Object);
    expect(back.hello).toBe(example.hello);
  });
  it('supports Set', () => {
    const example = new Set([1, 2, 3]);
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = eval(result) as Set<number>;
    expect(back).toBeInstanceOf(Set);
    expect(back.has(1)).toBe(example.has(1));
    expect(back.has(2)).toBe(example.has(2));
    expect(back.has(3)).toBe(example.has(3));
  });
  it('supports Map', () => {
    const example = new Map([[1, 2], [3, 4]]);
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = eval(result) as Map<number, number>;
    expect(back).toBeInstanceOf(Map);
    expect(back.get(1)).toBe(example.get(1));
    expect(back.get(3)).toBe(example.get(3));
  });
  it('supports Date', () => {
    const example = new Date();
    const result = eval(seroval(example)) as Date;
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(example.toISOString());
  });
  it('supports RegExp', () => {
    const example = /[a-z0-9]+/i;
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = eval(result) as RegExp;
    expect(back).toBeInstanceOf(RegExp);
    expect(String(back)).toBe(String(example));
  });
  it('supports array holes', () => {
    const example = new Array(10);
    const result = seroval(example);
    expect(result).toMatchSnapshot();
    const back = eval(result) as ServerValue[];
    expect(0 in back).toBeFalsy();
    expect(back[0]).toBe(undefined);
    expect(back.length).toBe(example.length);
  });
  describe('self cyclic references', () => {
    it('supports Arrays', () => {
      const example: ServerValue[] = [];
      example[0] = example;
      example[1] = example;
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = eval(result) as ServerValue[];
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
    it('supports Objects', () => {
      const example: Record<string, ServerValue> = {};
      example.a = example;
      example.b = example;
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = eval(result) as Record<string, ServerValue>;
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Maps', () => {
      const example: Map<ServerValue, ServerValue> = new Map();
      example.set(example, example);
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = eval(result) as Map<ServerValue, ServerValue>;
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
    it('supports Sets', () => {
      const example: Set<ServerValue> = new Set();
      example.add(example);
      const result = seroval(example);
      expect(result).toMatchSnapshot();
      const back = eval(result) as Set<ServerValue>;
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
      const back = eval(result) as ServerValue[][];
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
      const back = eval(result) as ServerValue[][];
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
      const back = eval(result) as ServerValue[][];
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
});
