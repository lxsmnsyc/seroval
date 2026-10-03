import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary BigInt TypedArray', () => {
  it('supports BigInt64Array', async () => {
    const { value } = await roundtrip<BigInt64Array>(
      new BigInt64Array([-9223372036854775808n, 0n, 9223372036854775807n]),
    );
    expect(value).toBeInstanceOf(BigInt64Array);
    expect([...value]).toEqual([
      -9223372036854775808n,
      0n,
      9223372036854775807n,
    ]);
  });

  it('supports BigUint64Array', async () => {
    const { value } = await roundtrip<BigUint64Array>(
      new BigUint64Array([0n, 18446744073709551615n]),
    );
    expect(value).toBeInstanceOf(BigUint64Array);
    expect([...value]).toEqual([0n, 18446744073709551615n]);
  });

  it('supports empty BigInt TypedArrays', async () => {
    const { value } = await roundtrip<BigInt64Array>(new BigInt64Array(0));
    expect(value).toBeInstanceOf(BigInt64Array);
    expect(value.length).toBe(0);
  });

  it('supports views with a byte offset', async () => {
    const buffer = new BigInt64Array([1n, 2n, 3n, 4n]).buffer;
    const { value } = await roundtrip<BigInt64Array>(
      new BigInt64Array(buffer, 8, 2),
    );
    expect(value.byteOffset).toBe(8);
    expect([...value]).toEqual([2n, 3n]);
  });
});
