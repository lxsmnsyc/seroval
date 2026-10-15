import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromJSON, toJSON } from '../src';
import * as browser from '../src/core/binary-browser';
import * as neutral from '../src/core/binary-neutral';
import { SerovalNodeType } from '../src/core/constants';

const LENGTHS = [0, 1, 2, 3, 31, 381, 384, 4096];

function createBytes(length: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.from({ length }, (_, i) => (i * 31) & 255);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('environment binary helpers', () => {
  for (const [name, helpers] of [
    ['browser', browser],
    ['neutral', neutral],
  ] as const) {
    it(`encodes and decodes every length in the ${name} helper`, () => {
      for (const length of LENGTHS) {
        const bytes = createBytes(length);
        const source = Buffer.from(bytes).toString('base64');
        expect(helpers.encodeArrayBuffer(bytes.buffer)).toBe(source);
        expect(new Uint8Array(helpers.decodeArrayBuffer(source))).toEqual(
          bytes,
        );
      }
    });

    it(`rejects malformed base64 in the ${name} helper`, () => {
      for (const source of [
        '!',
        'A',
        'AAAA!',
        'YQ===',
        `${'A'.repeat(512)}!`,
      ]) {
        expect(() => helpers.decodeArrayBuffer(source)).toThrow();
      }
    });
  }

  it('works without Buffer in the browser helper', () => {
    vi.stubGlobal('Buffer', undefined);
    for (const length of LENGTHS) {
      const bytes = createBytes(length);
      const source = browser.encodeArrayBuffer(bytes.buffer);
      expect(new Uint8Array(browser.decodeArrayBuffer(source))).toEqual(bytes);
    }
  });

  it('keeps the Buffer paths in the neutral helper', () => {
    const from = vi.spyOn(Buffer, 'from');
    neutral.encodeArrayBuffer(new ArrayBuffer(1024));
    expect(from).toHaveBeenCalledTimes(1);
    from.mockClear();
    neutral.decodeArrayBuffer('AAAA'.repeat(128));
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('round-trips through the serializer entry points', () => {
    for (const length of LENGTHS) {
      const bytes = createBytes(length);
      expect(fromJSON(toJSON(bytes))).toEqual(bytes);
    }
  });

  it('rejects malformed bytes before reading the reference id', () => {
    const json = toJSON(new ArrayBuffer(1));
    if (json.t.t !== SerovalNodeType.ArrayBuffer) {
      throw new Error('Wrong fixture');
    }
    json.t.s = '!';
    let idReads = 0;
    Object.defineProperty(json.t, 'i', {
      get() {
        idReads++;
        throw new Error('Reference id was read before decoding');
      },
    });
    expect(() => fromJSON(json)).toThrow();
    expect(idReads).toBe(0);
  });
});
