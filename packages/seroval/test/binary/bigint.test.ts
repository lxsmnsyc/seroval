import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary bigint', () => {
  it('supports bigints', async () => {
    const { value } = await roundtrip<bigint>(9007199254740991n);
    expect(value).toBe(9007199254740991n);
  });

  it('supports negative bigints', async () => {
    const { value } = await roundtrip<bigint>(-9007199254740991n);
    expect(value).toBe(-9007199254740991n);
  });

  it('supports huge bigints', async () => {
    const source = 2n ** 1024n + 1n;
    const { value } = await roundtrip<bigint>(source);
    expect(value).toBe(source);
  });

  it('supports 1n and -1n', async () => {
    const { value } = await roundtrip<bigint[]>([1n, -1n]);
    expect(value).toEqual([1n, -1n]);
  });

  it('supports 0n', async () => {
    const { value } = await roundtrip<bigint>(0n);
    expect(value).toBe(0n);
  });

  it('supports bigints as Map keys', async () => {
    const { value } = await roundtrip<Map<bigint, string>>(
      new Map([[123456789012345678901234567890n, 'big']]),
    );
    expect(value.get(123456789012345678901234567890n)).toBe('big');
  });
});
