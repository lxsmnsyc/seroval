import { describe, expect, it } from 'vitest';
import { captureSerializeError, roundtrip, startSerialize } from './utils';

const MAX_TYPED_ARRAY_LENGTH = 1_000_000;

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
    const { value } = await roundtrip<Uint8ClampedArray>(new Uint8ClampedArray([0, 128, 255]));
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
    const { value } = await roundtrip<Uint8Array>(new Uint8Array(buffer, 2, 4));
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

  it('serializes a TypedArray at the length cap', async () => {
    const source = new Uint8Array(MAX_TYPED_ARRAY_LENGTH);
    const { value } = await roundtrip<Uint8Array>(source);
    expect(value.length).toBe(MAX_TYPED_ARRAY_LENGTH);
  });

  it('rejects serializing a TypedArray above the length cap', async () => {
    const source = new Uint8Array(MAX_TYPED_ARRAY_LENGTH + 1);
    const error = await captureSerializeError(source);
    expect(error).toBeInstanceOf(Error);
  });

  it('rejects serializing a BigIntTypedArray above the length cap', async () => {
    const source = new BigInt64Array(MAX_TYPED_ARRAY_LENGTH + 1);
    const error = await captureSerializeError(source);
    expect(error).toBeInstanceOf(Error);
  });

  it('rejects serializing a DataView above the length cap', async () => {
    const source = new DataView(new ArrayBuffer(MAX_TYPED_ARRAY_LENGTH + 1));
    const error = await captureSerializeError(source);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('binary compactArrayBufferViews', () => {
  function source(): { view: Uint8Array; data: DataView; big: BigInt64Array } {
    const buffer = new ArrayBuffer(4096);
    const view = new Uint8Array(buffer, 1024, 4);
    view.set([1, 2, 3, 4]);
    const data = new DataView(new ArrayBuffer(4096), 8, 2);
    data.setUint8(1, 7);
    const big = new BigInt64Array(new ArrayBuffer(4096), 16, 1);
    big[0] = 9n;
    return { view, data, big };
  }

  function byteLength(chunks: Uint8Array[]): number {
    return chunks.reduce((total, chunk) => total + chunk.length, 0);
  }

  it('sends only the bytes each view covers', async () => {
    const compact = startSerialize(source(), { compactArrayBufferViews: true });
    const full = startSerialize(source());
    await Promise.all([compact.done, full.done]);
    expect(byteLength(compact.transport.chunks)).toBeLessThan(200);
    expect(byteLength(full.transport.chunks)).toBeGreaterThan(3 * 4096);

    const { value } = await roundtrip<ReturnType<typeof source>>(source(), {
      serialize: { compactArrayBufferViews: true },
    });
    expect([...value.view]).toEqual([1, 2, 3, 4]);
    expect(value.view.byteOffset).toBe(0);
    expect(value.view.buffer.byteLength).toBe(4);
    expect(value.data.getUint8(1)).toBe(7);
    expect(value.data.buffer.byteLength).toBe(2);
    expect(value.big[0]).toBe(9n);
    expect(value.big.buffer.byteLength).toBe(8);
  });

  it('keeps the whole buffer by default', async () => {
    const { value } = await roundtrip<ReturnType<typeof source>>(source());
    expect(value.view.byteOffset).toBe(1024);
    expect(value.view.buffer.byteLength).toBe(4096);
  });
});
