import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
} from 'seroval';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import ImageDataPlugin from '../../../web/image-data';
import { captureSerializeError, roundtrip } from './utils';

// `ImageData` is not available under Node, so stand in a minimal, faithful
// implementation to exercise the plugin's real mapping logic.
class StubImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: string;
  constructor(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    settings?: { colorSpace?: string },
  ) {
    this.data = data;
    this.width = width;
    this.height = height;
    this.colorSpace = settings?.colorSpace ?? 'srgb';
  }
}

const PLUGINS = [ImageDataPlugin];

beforeAll(() => {
  vi.stubGlobal('ImageData', StubImageData);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function makeImageData(width: number, height: number): StubImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = i % 256;
  }
  return new StubImageData(data, width, height, { colorSpace: 'srgb' });
}

describe('binary ImageData', () => {
  it('supports ImageData', async () => {
    const source = makeImageData(2, 3);
    const { value } = await roundtrip<StubImageData>(source, PLUGINS);
    expect(value).toBeInstanceOf(StubImageData);
    expect(value.width).toBe(2);
    expect(value.height).toBe(3);
    expect(value.colorSpace).toBe('srgb');
    expect([...value.data]).toEqual([...source.data]);
  });

  it('preserves a display-p3 color space', async () => {
    const source = new StubImageData(new Uint8ClampedArray(4), 1, 1, {
      colorSpace: 'display-p3',
    });
    const { value } = await roundtrip<StubImageData>(source, PLUGINS);
    expect(value.colorSpace).toBe('display-p3');
  });

  it('supports ImageData nested in a structure', async () => {
    const { value } = await roundtrip<{ frame: StubImageData }>(
      { frame: makeImageData(1, 1) },
      PLUGINS,
    );
    expect(value.frame).toBeInstanceOf(StubImageData);
    expect(value.frame.data.length).toBe(4);
  });

  it('does not match non-ImageData values', async () => {
    // A plain value falls through the plugin's `test` and is serialized normally.
    const { value } = await roundtrip<{ hello: string }>(
      { hello: 'world' },
      PLUGINS,
    );
    expect(value).toEqual({ hello: 'world' });
  });

  it('reports plainly when ImageData is unavailable', async () => {
    // With the global removed the plugin's guard returns false, so a real
    // ImageData-shaped value is simply unsupported rather than crashing.
    vi.stubGlobal('ImageData', undefined);
    const orphan = new StubImageData(new Uint8ClampedArray(4), 1, 1);
    const error = await captureSerializeError(orphan, PLUGINS);
    expect(error).toBeInstanceOf(Error);
    vi.stubGlobal('ImageData', StubImageData);
  });

  describe('string mode', () => {
    it('supports the sync serializer', () => {
      const back = deserialize<StubImageData>(
        serialize(makeImageData(2, 2), { plugins: PLUGINS }),
      );
      expect(back).toBeInstanceOf(StubImageData);
      expect(back.width).toBe(2);
      expect(back.colorSpace).toBe('srgb');
    });

    it('supports the async serializer', async () => {
      const back = deserialize<StubImageData>(
        await serializeAsync(makeImageData(1, 2), { plugins: PLUGINS }),
      );
      expect(back).toBeInstanceOf(StubImageData);
      expect(back.height).toBe(2);
    });

    it('supports the JSON tree form', () => {
      const source = makeImageData(1, 1);
      const back = fromJSON<StubImageData>(
        toJSON(source, { plugins: PLUGINS }),
        { plugins: PLUGINS },
      );
      expect(back).toBeInstanceOf(StubImageData);
      expect([...back.data]).toEqual([...source.data]);
    });
  });
});
