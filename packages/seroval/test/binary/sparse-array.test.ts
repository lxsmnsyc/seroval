import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

// biome-ignore lint/suspicious/noSparseArray: the point of the test
const EXAMPLE = [, , , 1, , , , 2, , , ,];

describe('binary sparse Array', () => {
  it('supports sparse arrays', async () => {
    const { value } = await roundtrip<unknown[]>(EXAMPLE);
    expect(value).toHaveLength(EXAMPLE.length);
    expect(value[3]).toBe(1);
    expect(value[7]).toBe(2);
  });

  it('preserves holes', async () => {
    const { value } = await roundtrip<unknown[]>(EXAMPLE);
    expect(0 in value).toBe(false);
    expect(3 in value).toBe(true);
    expect(4 in value).toBe(false);
    expect(7 in value).toBe(true);
    expect(10 in value).toBe(false);
  });

  it('distinguishes holes from explicit undefined', async () => {
    const source = [undefined, , undefined];
    const { value } = await roundtrip<unknown[]>(source);
    expect(0 in value).toBe(true);
    expect(1 in value).toBe(false);
    expect(2 in value).toBe(true);
    expect(value[0]).toBe(undefined);
  });

  it('supports an array of only holes', async () => {
    const { value } = await roundtrip<unknown[]>(new Array(5));
    expect(value).toHaveLength(5);
    expect(Object.keys(value)).toEqual([]);
  });
});
