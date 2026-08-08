import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Array', () => {
  it('supports arrays', async () => {
    const { value } = await roundtrip<number[]>([1, 2, 3]);
    expect(value).toBeInstanceOf(Array);
    expect(value).toEqual([1, 2, 3]);
  });

  it('supports empty arrays', async () => {
    const { value } = await roundtrip<unknown[]>([]);
    expect(value).toEqual([]);
    expect(value).toHaveLength(0);
  });

  it('supports mixed arrays', async () => {
    const source = [1, 'two', true, null, undefined, 6n];
    const { value } = await roundtrip<unknown[]>(source);
    expect(value).toEqual(source);
  });

  it('supports nested arrays', async () => {
    const { value } = await roundtrip<unknown[]>([[1, [2, [3]]]]);
    expect(value).toEqual([[1, [2, [3]]]]);
  });

  it('supports self-referencing arrays', async () => {
    const source: unknown[] = [1];
    source.push(source);
    const { value } = await roundtrip<unknown[]>(source);
    expect(value[0]).toBe(1);
    expect(value[1]).toBe(value);
  });

  it('preserves identity of repeated items', async () => {
    const item = { id: 1 };
    const { value } = await roundtrip<{ id: number }[]>([item, item]);
    expect(value[0]).toBe(value[1]);
  });

  it('supports frozen arrays', async () => {
    const { value } = await roundtrip<number[]>(Object.freeze([1, 2, 3]));
    expect(value).toEqual([1, 2, 3]);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it('supports sealed arrays', async () => {
    const { value } = await roundtrip<number[]>(Object.seal([1, 2, 3]));
    expect(value).toEqual([1, 2, 3]);
    expect(Object.isSealed(value)).toBe(true);
  });

  it('supports non-extensible arrays', async () => {
    const { value } = await roundtrip<number[]>(
      Object.preventExtensions([1, 2, 3]),
    );
    expect(value).toEqual([1, 2, 3]);
    expect(Object.isExtensible(value)).toBe(false);
  });

  it('supports large arrays', async () => {
    const source = Array.from({ length: 1000 }, (_, i) => i);
    const { value } = await roundtrip<number[]>(source);
    expect(value).toHaveLength(1000);
    expect(value[999]).toBe(999);
  });
});
