import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary ArrayBuffer', () => {
  it('supports ArrayBuffer', async () => {
    const source = new Uint8Array([1, 2, 3, 255]).buffer;
    const { value } = await roundtrip<ArrayBuffer>(source);
    expect(value).toBeInstanceOf(ArrayBuffer);
    expect(value.byteLength).toBe(4);
    expect([...new Uint8Array(value)]).toEqual([1, 2, 3, 255]);
  });

  it('supports empty ArrayBuffer', async () => {
    const { value } = await roundtrip<ArrayBuffer>(new ArrayBuffer(0));
    expect(value).toBeInstanceOf(ArrayBuffer);
    expect(value.byteLength).toBe(0);
  });

  it('supports large ArrayBuffer', async () => {
    const source = new Uint8Array(10_000).map((_, i) => i % 256);
    const { value } = await roundtrip<ArrayBuffer>(source.buffer);
    expect(value.byteLength).toBe(10_000);
    expect([...new Uint8Array(value)]).toEqual([...source]);
  });
});

describe('binary TypedArray', () => {
  it('supports Int8Array', async () => {
    const { value } = await roundtrip<Int8Array>(new Int8Array([-1, 0, 127]));
    expect(value).toBeInstanceOf(Int8Array);
    expect([...value]).toEqual([-1, 0, 127]);
  });

  it('supports Uint8Array', async () => {
    const { value } = await roundtrip<Uint8Array>(new Uint8Array([1, 2, 3]));
    expect(value).toBeInstanceOf(Uint8Array);
    expect([...value]).toEqual([1, 2, 3]);
  });

  it('supports Uint8ClampedArray', async () => {
    const { value } = await roundtrip<Uint8ClampedArray>(
      new Uint8ClampedArray([0, 128, 255]),
    );
    expect(value).toBeInstanceOf(Uint8ClampedArray);
    expect([...value]).toEqual([0, 128, 255]);
  });

  it('supports Int16Array and Uint16Array', async () => {
    const { value } = await roundtrip<[Int16Array, Uint16Array]>([
      new Int16Array([-32768, 32767]),
      new Uint16Array([0, 65535]),
    ]);
    expect([...value[0]]).toEqual([-32768, 32767]);
    expect([...value[1]]).toEqual([0, 65535]);
  });

  it('supports Int32Array and Uint32Array', async () => {
    const { value } = await roundtrip<[Int32Array, Uint32Array]>([
      new Int32Array([-2147483648, 2147483647]),
      new Uint32Array([0, 4294967295]),
    ]);
    expect([...value[0]]).toEqual([-2147483648, 2147483647]);
    expect([...value[1]]).toEqual([0, 4294967295]);
  });

  it('supports Float32Array and Float64Array', async () => {
    const { value } = await roundtrip<[Float32Array, Float64Array]>([
      new Float32Array([0.5, -1.5]),
      new Float64Array([0.1, Number.MAX_VALUE]),
    ]);
    expect([...value[0]]).toEqual([0.5, -1.5]);
    expect([...value[1]]).toEqual([0.1, Number.MAX_VALUE]);
  });

  it('supports empty TypedArrays', async () => {
    const { value } = await roundtrip<Uint8Array>(new Uint8Array(0));
    expect(value).toBeInstanceOf(Uint8Array);
    expect(value.length).toBe(0);
  });

  it('supports views with a byte offset', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    const { value } = await roundtrip<Uint8Array>(
      new Uint8Array(buffer, 2, 4),
    );
    expect(value.byteOffset).toBe(2);
    expect([...value]).toEqual([3, 4, 5, 6]);
    expect(value.buffer.byteLength).toBe(8);
  });

  it('shares one buffer between overlapping views', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const { value } = await roundtrip<[Uint8Array, Uint8Array]>([
      new Uint8Array(buffer, 0, 2),
      new Uint8Array(buffer, 2, 2),
    ]);
    expect(value[0].buffer).toBe(value[1].buffer);
    value[0][0] = 9;
    expect(new Uint8Array(value[1].buffer)[0]).toBe(9);
  });

  it('preserves identity of a repeated TypedArray', async () => {
    const array = new Uint8Array([1]);
    const { value } = await roundtrip<Uint8Array[]>([array, array]);
    expect(value[0]).toBe(value[1]);
  });
});
