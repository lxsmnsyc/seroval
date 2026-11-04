import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';
import { roundtrip, startSerialize } from './utils';

function defineOwn<T extends object>(target: T, key: string, value: unknown): T {
  Object.defineProperty(target, key, { value });
  return target;
}

describe('binary values that replace class members', () => {
  it('reads a Date through its internal state', async () => {
    const { value } = await roundtrip<Date>(
      Object.assign(new Date(0), { getTime: () => 1, valueOf: () => 1 }),
    );
    expect(value).toBeInstanceOf(Date);
    expect(value.getTime()).toBe(0);
  });

  it('does not write an object with Date.prototype as a Date', async () => {
    const handle = startSerialize(
      Object.assign(Object.create(Date.prototype), { getTime: () => 1 }),
    );
    await expect(handle.done).rejects.toThrow();
  });

  it('reads a RegExp through its internal state', async () => {
    const { value } = await roundtrip<RegExp>(
      defineOwn(defineOwn(/a/g, 'source', 'b'), 'flags', 'i'),
    );
    expect(value.source).toBe('a');
    expect(value.flags).toBe('g');
  });

  it('reads a Temporal value through its internal state', async () => {
    const { value } = await roundtrip(
      Object.assign(Temporal.PlainDate.from('2026-01-01'), { toString: () => '1999-01-01' }),
    );
    expect(String(value)).toBe('2026-01-01');
  });

  it('reads a typed array through its internal state', async () => {
    const source = defineOwn(
      defineOwn(
        defineOwn(new Uint8Array(new ArrayBuffer(8), 2, 4), 'byteOffset', 0),
        'length',
        1,
      ),
      'buffer',
      new ArrayBuffer(1),
    );
    const { value } = await roundtrip<Uint8Array>(source);
    expect(value).toBeInstanceOf(Uint8Array);
    expect(value.byteOffset).toBe(2);
    expect(value.length).toBe(4);
    expect(value.buffer.byteLength).toBe(8);
  });

  it('reads a BigInt typed array through its internal state', async () => {
    const { value } = await roundtrip<BigInt64Array>(
      defineOwn(new BigInt64Array([1n, 2n]), 'length', 1),
    );
    expect([...value]).toEqual([1n, 2n]);
  });

  it('reads a DataView through its internal state', async () => {
    const source = defineOwn(
      defineOwn(new DataView(new ArrayBuffer(8), 2, 4), 'byteOffset', 0),
      'byteLength',
      1,
    );
    const { value } = await roundtrip<DataView>(source);
    expect(value).toBeInstanceOf(DataView);
    expect(value.byteOffset).toBe(2);
    expect(value.byteLength).toBe(4);
  });

  it('does not write an object with Uint8Array.prototype as a view', async () => {
    const forged = Object.create(Uint8Array.prototype) as object;
    defineOwn(defineOwn(defineOwn(forged, 'buffer', new ArrayBuffer(4)), 'byteOffset', 0), 'length', 4);
    const handle = startSerialize(forged);
    await expect(handle.done).rejects.toThrow();
  });
});
