import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Set', () => {
  it('supports Set', async () => {
    const { value } = await roundtrip<Set<number>>(new Set([1, 2, 3]));
    expect(value).toBeInstanceOf(Set);
    expect(value.size).toBe(3);
    expect([...value]).toEqual([1, 2, 3]);
  });

  it('supports empty Set', async () => {
    const { value } = await roundtrip<Set<unknown>>(new Set());
    expect(value).toBeInstanceOf(Set);
    expect(value.size).toBe(0);
  });

  it('preserves insertion order', async () => {
    const { value } = await roundtrip<Set<string>>(new Set(['z', 'a', 'm']));
    expect([...value]).toEqual(['z', 'a', 'm']);
  });

  it('supports exotic members', async () => {
    const { value } = await roundtrip<Set<unknown>>(
      new Set<unknown>([1n, Number.NaN, undefined, null, new Date(0)]),
    );
    expect(value.has(1n)).toBe(true);
    expect(value.has(Number.NaN)).toBe(true);
    expect(value.has(undefined)).toBe(true);
    expect(value.has(null)).toBe(true);
    expect(value.size).toBe(5);
  });

  it('supports self-referencing Set', async () => {
    const source = new Set<unknown>();
    source.add(source);
    const { value } = await roundtrip<Set<unknown>>(source);
    expect(value.has(value)).toBe(true);
    expect(value.size).toBe(1);
  });

  it('deduplicates shared members', async () => {
    const shared = { id: 1 };
    const { value } = await roundtrip<{ set: Set<object>; item: object }>({
      set: new Set([shared]),
      item: shared,
    });
    expect(value.set.has(value.item)).toBe(true);
  });

  it('supports nested Sets', async () => {
    const { value } = await roundtrip<Set<Set<string>>>(
      new Set([new Set(['deep'])]),
    );
    const [inner] = [...value];
    expect(inner).toBeInstanceOf(Set);
    expect([...inner]).toEqual(['deep']);
  });
});
