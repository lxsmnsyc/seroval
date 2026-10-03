import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary number', () => {
  it('supports integers', async () => {
    const { value } = await roundtrip<number>(1_000_000);
    expect(value).toBe(1_000_000);
  });

  it('supports negative integers', async () => {
    const { value } = await roundtrip<number>(-42);
    expect(value).toBe(-42);
  });

  it('supports floats', async () => {
    const { value } = await roundtrip<number>(0.1 + 0.2);
    expect(value).toBe(0.1 + 0.2);
  });

  it('supports MAX_SAFE_INTEGER and MIN_SAFE_INTEGER', async () => {
    const { value } = await roundtrip<number[]>([
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
    ]);
    expect(value).toEqual([Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]);
  });

  it('supports MAX_VALUE, MIN_VALUE and EPSILON', async () => {
    const { value } = await roundtrip<number[]>([
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Number.EPSILON,
    ]);
    expect(value).toEqual([Number.MAX_VALUE, Number.MIN_VALUE, Number.EPSILON]);
  });

  it('supports NaN', async () => {
    const { value } = await roundtrip<number>(Number.NaN);
    expect(value).toBeNaN();
  });

  it('supports Infinity', async () => {
    const { value } = await roundtrip<number>(Number.POSITIVE_INFINITY);
    expect(value).toBe(Number.POSITIVE_INFINITY);
  });

  it('supports -Infinity', async () => {
    const { value } = await roundtrip<number>(Number.NEGATIVE_INFINITY);
    expect(value).toBe(Number.NEGATIVE_INFINITY);
  });

  it('supports -0', async () => {
    const { value } = await roundtrip<number>(-0);
    expect(Object.is(value, -0)).toBe(true);
  });

  it('supports 0', async () => {
    const { value } = await roundtrip<number>(0);
    expect(Object.is(value, 0)).toBe(true);
  });

  it('deduplicates repeated numbers', async () => {
    const { value } = await roundtrip<number[]>([123, 123]);
    expect(value).toEqual([123, 123]);
  });

  it('keeps 0 and -0 distinct', async () => {
    const { value } = await roundtrip<number[]>([0, -0]);
    expect(Object.is(value[0], 0)).toBe(true);
    expect(Object.is(value[1], -0)).toBe(true);
  });

  it('keeps -0 distinct when it comes first', async () => {
    const { value } = await roundtrip<number[]>([-0, 0]);
    expect(Object.is(value[0], -0)).toBe(true);
    expect(Object.is(value[1], 0)).toBe(true);
  });

  it('does not confuse small numbers with constant tags', async () => {
    // Each constant has a numeric tag; those tags must not be mistaken for
    // the numbers 0-7 sharing the same reference table.
    const source = [
      null,
      undefined,
      true,
      false,
      -0,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
    ];
    const { value } = await roundtrip<unknown[]>(source);
    expect(value.slice(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(value.slice(0, 4)).toEqual([null, undefined, true, false]);
  });

  it('does not confuse constant tags with small numbers', async () => {
    const { value } = await roundtrip<unknown[]>([
      0,
      1,
      2,
      3,
      null,
      undefined,
      true,
      false,
    ]);
    expect(value).toEqual([0, 1, 2, 3, null, undefined, true, false]);
  });
});
