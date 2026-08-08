import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

const EXAMPLE = {
  title: 'Hello World',
  *[Symbol.iterator](): IterableIterator<number> {
    yield 1;
    yield 2;
    yield 3;
  },
};

describe('binary Iterable', () => {
  it('supports Iterables', async () => {
    const { value } = await roundtrip<typeof EXAMPLE>(EXAMPLE);
    expect(value.title).toBe('Hello World');
    expect(Symbol.iterator in value).toBe(true);
    expect([...value]).toEqual([1, 2, 3]);
  });

  it('replays the iterator from the start on every call', async () => {
    const { value } = await roundtrip<typeof EXAMPLE>(EXAMPLE);
    expect([...value]).toEqual([1, 2, 3]);
    expect([...value]).toEqual([1, 2, 3]);
  });

  it('supports empty Iterables', async () => {
    const { value } = await roundtrip<Iterable<number>>({
      *[Symbol.iterator](): IterableIterator<number> {},
    });
    expect([...value]).toEqual([]);
  });

  it('supports Iterables of exotic values', async () => {
    const { value } = await roundtrip<Iterable<unknown>>({
      *[Symbol.iterator](): IterableIterator<unknown> {
        yield new Date(0);
        yield 1n;
        yield { nested: true };
      },
    });
    const items = [...value];
    expect(items[0]).toBeInstanceOf(Date);
    expect(items[1]).toBe(1n);
    expect(items[2]).toEqual({ nested: true });
  });

  it('supports Iterables that throw', async () => {
    const { value } = await roundtrip<Iterable<number>>({
      *[Symbol.iterator](): IterableIterator<number> {
        yield 1;
        throw new Error('iteration failed');
      },
    });
    const iterator = value[Symbol.iterator]();
    expect(iterator.next().value).toBe(1);
    expect(() => iterator.next()).toThrow('iteration failed');
  });

  it('supports Iterables alongside other properties', async () => {
    const { value } = await roundtrip<{ id: number } & Iterable<string>>({
      id: 7,
      *[Symbol.iterator](): IterableIterator<string> {
        yield 'a';
      },
    });
    expect(value.id).toBe(7);
    expect([...value]).toEqual(['a']);
  });
});
