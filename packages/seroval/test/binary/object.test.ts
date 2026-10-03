import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Object', () => {
  it('supports objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>({
      hello: 'world',
      count: 1,
      flag: true,
      nothing: null,
      missing: undefined,
    });
    expect(value.constructor).toBe(Object);
    expect(value).toEqual({
      hello: 'world',
      count: 1,
      flag: true,
      nothing: null,
      missing: undefined,
    });
  });

  it('supports empty objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>({});
    expect(Object.keys(value)).toEqual([]);
  });

  it('supports nested objects', async () => {
    const { value } = await roundtrip<{ a: { b: { c: string } } }>({
      a: { b: { c: 'deep' } },
    });
    expect(value.a.b.c).toBe('deep');
  });

  it('supports self-referencing objects', async () => {
    interface Cyclic {
      self?: Cyclic;
    }
    const source: Cyclic = {};
    source.self = source;
    const { value } = await roundtrip<Cyclic>(source);
    expect(value.self).toBe(value);
  });

  it('preserves identity of repeated values', async () => {
    const shared = { id: 1 };
    const { value } = await roundtrip<Record<string, unknown>>({
      a: shared,
      b: shared,
    });
    expect(value.a).toBe(value.b);
  });

  it('supports unusual keys', async () => {
    const source = {
      '': 'empty',
      '0b1': 'binary',
      'key with spaces': true,
      'ハロー': 'world',
      '👋': 'wave',
    };
    const { value } = await roundtrip<Record<string, unknown>>(source);
    expect(value).toEqual(source);
  });

  it('does not pollute the prototype', async () => {
    const source: Record<string, unknown> = {};
    Object.defineProperty(source, '__proto__', {
      value: { polluted: true },
      configurable: true,
      enumerable: true,
      writable: true,
    });
    const { value } = await roundtrip<Record<string, unknown>>(source);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBe(undefined);
  });

  it('supports Symbol.toStringTag', async () => {
    const { value } = await roundtrip<Record<string | symbol, unknown>>({
      [Symbol.toStringTag]: 'Tagged',
      hello: 'world',
    });
    expect(value[Symbol.toStringTag]).toBe('Tagged');
    expect(Object.prototype.toString.call(value)).toBe('[object Tagged]');
  });

  it('supports Symbol.isConcatSpreadable', async () => {
    const { value } = await roundtrip<Record<string | symbol, unknown>>({
      [Symbol.isConcatSpreadable]: true,
      length: 2,
      0: 'a',
      1: 'b',
    });
    expect(value[Symbol.isConcatSpreadable]).toBe(true);
    expect([].concat(value as never)).toEqual(['a', 'b']);
  });
});
