import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary DataView', () => {
  it('supports DataView', async () => {
    const source = new DataView(new ArrayBuffer(8));
    source.setFloat64(0, 1234.5678);
    const { value } = await roundtrip<DataView>(source);
    expect(value).toBeInstanceOf(DataView);
    expect(value.byteLength).toBe(8);
    expect(value.getFloat64(0)).toBe(1234.5678);
  });

  it('supports empty DataView', async () => {
    const { value } = await roundtrip<DataView>(
      new DataView(new ArrayBuffer(0)),
    );
    expect(value).toBeInstanceOf(DataView);
    expect(value.byteLength).toBe(0);
  });

  it('supports views with a byte offset', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    const { value } = await roundtrip<DataView>(new DataView(buffer, 4, 4));
    expect(value.byteOffset).toBe(4);
    expect(value.byteLength).toBe(4);
    expect(value.getUint8(0)).toBe(5);
    expect(value.buffer.byteLength).toBe(8);
  });

  it('shares the buffer with a TypedArray over the same bytes', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const { value } = await roundtrip<[DataView, Uint8Array]>([
      new DataView(buffer),
      new Uint8Array(buffer),
    ]);
    expect(value[0].buffer).toBe(value[1].buffer);
  });
});
