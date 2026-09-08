import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type BaseParserContextOptions,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  Serializer,
  SerovalDeserializationError,
  SerovalMalformedNodeError,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('binary encoding', () => {
  it('encodes binary values in Node without btoa', () => {
    vi.stubGlobal('btoa', undefined);
    expect(toJSON(new Uint8Array([0, 127, 255]).buffer).t.s).toBe('AH//');
  });
  for (const native of [true, false]) {
    it(`preserves all byte values and base64 padding (native: ${native})`, () => {
      if (!native) {
        vi.stubGlobal('Buffer', undefined);
      }
      for (const length of [0, 1, 2, 3, 256, 257, 258, 4096]) {
        const bytes = Uint8Array.from({ length }, (_, i) => i % 256);
        const json = toJSON(bytes.buffer);
        expect(json.t.s).toBe(Buffer.from(bytes).toString('base64'));
        expect(new Uint8Array(fromJSON<ArrayBuffer>(json))).toEqual(bytes);
        expect(
          new Uint8Array(deserialize<ArrayBuffer>(serialize(bytes.buffer))),
        ).toEqual(bytes);
      }
    });
  }
});

describe('binary decoding validation', () => {
  for (const native of [true, false]) {
    it(`preserves accepted padding and whitespace (native: ${native})`, () => {
      if (!native) {
        vi.stubGlobal('Buffer', undefined);
      }
      for (const [source, expected] of [
        ['', []],
        ['YQ', [97]],
        ['YQ==', [97]],
        ['YWI', [97, 98]],
        ['YWI=', [97, 98]],
        [' Y\tW\nI=\r', [97, 98]],
      ] as const) {
        for (const padding of ['', ' '.repeat(512)]) {
          const json = toJSON(new ArrayBuffer(0));
          json.t.s = padding + source;
          const back = fromJSON<ArrayBuffer>(json);
          expect(back.byteLength).toBe(expected.length);
          expect([...new Uint8Array(back)]).toEqual(expected);
        }
      }
    });

    it(`rejects malformed base64 (native: ${native})`, () => {
      if (!native) {
        vi.stubGlobal('Buffer', undefined);
      }
      for (const source of ['!!!!', 'YQ=', 'YQ===', '_w==', 'A', 'YQ==A']) {
        for (const padding of ['', ' '.repeat(512)]) {
          const json = toJSON(new ArrayBuffer(0));
          json.t.s = padding + source;
          expect(() => fromJSON(json)).toThrow(SerovalDeserializationError);
          expect(() => fromCrossJSON(json.t, { refs: new Map() })).toThrow(
            SerovalDeserializationError,
          );
        }
      }
    });
  }

  it('preserves exact buffer lengths and independence across the native cutoff', () => {
    for (const length of [381, 382, 383, 384, 385, 4095, 4096, 4097]) {
      const bytes = Uint8Array.from({ length }, (_, i) => i % 256);
      const json = toJSON(bytes.buffer);
      const first = fromJSON<ArrayBuffer>(json);
      const second = fromJSON<ArrayBuffer>(json);
      expect(first.byteLength).toBe(length);
      expect(new Uint8Array(first)).toEqual(bytes);
      new Uint8Array(first).fill(42);
      expect(new Uint8Array(second)).toEqual(bytes);
    }
  });
});

describe('compact ArrayBuffer views', () => {
  it('preserves backing-buffer identity and offsets by default', () => {
    const buffer = new ArrayBuffer(32);
    const view = new Uint8Array(buffer, 8, 8);
    const back = fromJSON<{ buffer: ArrayBuffer; view: Uint8Array }>(
      toJSON({ buffer, view }),
    );
    expect(back.view.buffer).toBe(back.buffer);
    expect(back.view.byteOffset).toBe(8);
    expect(back.buffer.byteLength).toBe(32);
  });

  it('preserves floating-point bytes, including NaN payloads and negative zero', () => {
    const buffer = new ArrayBuffer(16);
    new Uint32Array(buffer, 4, 2).set([0x7fc00001, 0x80000000]);
    const view = new Float32Array(buffer, 4, 2);
    const back = fromJSON<Float32Array>(
      toJSON(view, { compactArrayBufferViews: true }),
    );
    expect(new Uint8Array(back.buffer)).toEqual(new Uint8Array(buffer, 4, 8));
  });
  it('serializes only the visible bytes when explicitly enabled', () => {
    const buffer = new ArrayBuffer(512 * 1024);
    const view = new Uint8Array(buffer, 128, 1024);
    view.fill(42);
    const back = fromJSON<Uint8Array>(
      toJSON(view, { compactArrayBufferViews: true }),
    );
    expect(back).toEqual(view);
    expect(back.byteOffset).toBe(0);
    expect(back.buffer.byteLength).toBe(view.byteLength);
  });

  const modes: Record<
    string,
    (value: unknown, options: BaseParserContextOptions) => unknown
  > = {
    serialize: (value, options) => deserialize(serialize(value, options)),
    serializeAsync: async (value, options) =>
      deserialize(await serializeAsync(Promise.resolve(value), options)),
    toJSON: (value, options) => fromJSON(toJSON(value, options)),
    toJSONAsync: async (value, options) =>
      fromJSON(await toJSONAsync(Promise.resolve(value), options)),
    crossSerialize: (value, options) =>
      new Function('$R', `return (${crossSerialize(value, options)})`)([]),
    crossSerializeAsync: async (value, options) =>
      new Function(
        '$R',
        `return (${await crossSerializeAsync(Promise.resolve(value), options)})`,
      )([]),
    toCrossJSON: (value, options) =>
      fromCrossJSON(toCrossJSON(value, options), { refs: new Map() }),
    toCrossJSONAsync: async (value, options) =>
      fromCrossJSON(await toCrossJSONAsync(Promise.resolve(value), options), {
        refs: new Map(),
      }),
    toCrossJSONStream: (value, options) =>
      new Promise((resolve, reject) => {
        const refs = new Map();
        let back: unknown;
        toCrossJSONStream(Promise.resolve(value), {
          ...options,
          onParse(node, initial) {
            const result = fromCrossJSON(node, { refs });
            if (initial) {
              back = result;
            }
          },
          onDone() {
            resolve(back);
          },
          onError: reject,
        });
      }),
    crossSerializeStream: (value, options) =>
      new Promise((resolve, reject) => {
        const refs: unknown[] = [];
        let back: unknown;
        crossSerializeStream(Promise.resolve(value), {
          ...options,
          onSerialize(source, initial) {
            const result = new Function('$R', `return (${source})`)(refs);
            if (initial) {
              back = result;
            }
          },
          onDone() {
            resolve(back);
          },
          onError: reject,
        });
      }),
    Serializer: (value, options) =>
      new Promise((resolve, reject) => {
        const values: Record<string, unknown> = {};
        const refs: unknown[] = [];
        const serializer = new Serializer({
          ...options,
          globalIdentifier: 'values',
          onData(source) {
            new Function('values', '$R', source)(values, refs);
          },
          onDone() {
            resolve(values.value);
          },
          onError: reject,
        });
        serializer.write('value', Promise.resolve(value));
        serializer.flush();
      }),
  };

  for (const [name, roundTrip] of Object.entries(modes)) {
    for (const compactArrayBufferViews of [false, true]) {
      it(`preserves view identity and the selected buffer semantics in ${name} (compact: ${compactArrayBufferViews})`, async () => {
        const buffer = Uint8Array.from({ length: 32 }, (_, i) => i).buffer;
        const first = new Uint8Array(buffer, 8, 8);
        const second = new Uint16Array(buffer, 8, 4);
        const full = new Uint8Array(buffer);
        const input = { first, again: first, second, full, buffer };
        const back = (await roundTrip(input, {
          compactArrayBufferViews,
        })) as typeof input;
        expect(back.first).toEqual(first);
        expect(back.second).toEqual(second);
        expect(back.full).toEqual(full);
        expect(back.first).toBe(back.again);
        expect(back.first.byteOffset).toBe(compactArrayBufferViews ? 0 : 8);
        expect(back.first.buffer.byteLength).toBe(
          compactArrayBufferViews ? 8 : 32,
        );
        if (compactArrayBufferViews) {
          expect(back.first.buffer).not.toBe(back.second.buffer);
          expect(back.full.buffer).not.toBe(back.buffer);
        } else {
          expect(back.first.buffer).toBe(back.second.buffer);
          expect(back.first.buffer).toBe(back.buffer);
          expect(back.full.buffer).toBe(back.buffer);
        }
        expect(new Uint8Array(back.buffer)).toEqual(full);
        expect(first.byteOffset).toBe(8);
        expect(first.buffer).toBe(buffer);
      });
    }

    it(`compacts every supported view type, including empty views, in ${name}`, async () => {
      const buffer = Uint8Array.from({ length: 32 }, (_, i) => i).buffer;
      const constructors: (new (
        buffer: ArrayBuffer,
        byteOffset: number,
        length: number,
      ) => ArrayBufferView<ArrayBuffer>)[] = [
        Int8Array,
        Uint8Array,
        Uint8ClampedArray,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
        BigInt64Array,
        BigUint64Array,
        DataView,
      ];
      const views = constructors.flatMap(Constructor => [
        new Constructor(buffer, 8, 2),
        new Constructor(buffer, 32, 0),
      ]);
      const back = (await roundTrip(views, {
        compactArrayBufferViews: true,
      })) as typeof views;
      for (let i = 0; i < views.length; i++) {
        expect(back[i].constructor).toBe(views[i].constructor);
        expect(back[i].byteOffset).toBe(0);
        expect(back[i].buffer.byteLength).toBe(views[i].byteLength);
        expect(new Uint8Array(back[i].buffer)).toEqual(
          new Uint8Array(buffer, views[i].byteOffset, views[i].byteLength),
        );
      }
    });
  }
});

describe('binary decoding limits', () => {
  it('allows a 1 MiB buffer with an explicit receiver limit', () => {
    const bytes = new Uint8Array(1024 * 1024).fill(42);
    const json = toJSON(bytes.buffer);
    expect(() => fromJSON(json)).toThrow();
    const back = fromJSON<ArrayBuffer>(json, { maxBase64Length: 1_398_104 });
    expect(Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);
  });

  for (const cross of [false, true]) {
    const encode = (value: unknown) =>
      cross ? toCrossJSON(value) : toJSON(value).t;
    const decode = (
      node: ReturnType<typeof encode>,
      maxBase64Length?: number,
    ) =>
      cross
        ? fromCrossJSON<ArrayBuffer>(node, { refs: new Map(), maxBase64Length })
        : fromJSON<ArrayBuffer>(
            { t: node, m: [], f: toJSON(null).f },
            { maxBase64Length },
          );

    it(`enforces the default and configured boundaries (cross: ${cross})`, () => {
      expect(decode(encode(new ArrayBuffer(750_000))).byteLength).toBe(750_000);
      expect(() => decode(encode(new ArrayBuffer(750_001)))).toThrow(
        SerovalDeserializationError,
      );
      expect(
        decode(encode(new ArrayBuffer(1024 * 1024)), 1_398_104).byteLength,
      ).toBe(1024 * 1024);
      expect(() =>
        decode(encode(new ArrayBuffer(1024 * 1024)), 1_398_103),
      ).toThrow(SerovalDeserializationError);
      expect(decode(encode(new ArrayBuffer(0)), 0).byteLength).toBe(0);
      expect(() => decode(encode(new ArrayBuffer(1)), 0)).toThrow(
        SerovalDeserializationError,
      );
      expect(decode(encode(new ArrayBuffer(3)), 4).byteLength).toBe(3);
      expect(() => decode(encode(new ArrayBuffer(4)), 4)).toThrow(
        SerovalDeserializationError,
      );
    });

    it(`rejects invalid limits without disabling protection (cross: ${cross})`, () => {
      for (const limit of [
        -1,
        0.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        expect(() => decode(encode(new ArrayBuffer(0)), limit)).toThrow(
          RangeError,
        );
      }
    });

    it(`rejects malformed base64 fields and reports oversize input (cross: ${cross})`, () => {
      for (const value of [null, 123, {}, { length: 0 }, ['AA==']]) {
        const node = { ...encode(new ArrayBuffer(0)), s: value } as ReturnType<
          typeof encode
        >;
        try {
          decode(node);
          expect.unreachable();
        } catch (error) {
          expect(error).toBeInstanceOf(SerovalDeserializationError);
          expect((error as SerovalDeserializationError).cause).toBeInstanceOf(
            SerovalMalformedNodeError,
          );
        }
      }
      try {
        decode(encode(new ArrayBuffer(3)), 0);
        expect.unreachable();
      } catch (error) {
        expect((error as SerovalDeserializationError).cause).toEqual(
          new RangeError('ArrayBuffer exceeds maxBase64Length (0)'),
        );
      }
      expect(() =>
        decode({ ...encode(new ArrayBuffer(0)), s: '!!!!' } as ReturnType<
          typeof encode
        >),
      ).toThrow();
    });
  }
});
