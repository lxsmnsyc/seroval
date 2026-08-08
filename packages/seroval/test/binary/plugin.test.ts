import { describe, expect, it, vi } from 'vitest';
import { binary, createPlugin, type SerovalNode } from '../../src';
import {
  captureSerializeError,
  createTransport,
  roundtrip,
  startSerialize,
} from './utils';

class Vector {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

interface VectorData {
  x: number;
  y: number;
}

const VectorPlugin = createPlugin<Vector, SerovalNode, VectorData>({
  tag: 'Vector',
  test(value) {
    return value instanceof Vector;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse([value.x, value.y]);
    },
    async async(value, ctx) {
      return await ctx.parse([value.x, value.y]);
    },
    stream(value, ctx) {
      return ctx.parse([value.x, value.y]);
    },
  },
  serialize(node, ctx) {
    return `new Vector(${ctx.serialize(node)})`;
  },
  deserialize(node, ctx) {
    const [x, y] = ctx.deserialize(node) as [number, number];
    return new Vector(x, y);
  },
  binary: {
    serialize(value) {
      return { x: value.x, y: value.y };
    },
    deserialize(value) {
      return new Vector(value.x, value.y);
    },
  },
});

const PLUGINS = [VectorPlugin];

describe('binary Plugin', () => {
  it('supports plugins', async () => {
    const { value } = await roundtrip<Vector>(new Vector(1, 2), {
      serialize: { plugins: PLUGINS },
      deserialize: { plugins: PLUGINS },
    });
    expect(value).toBeInstanceOf(Vector);
    expect(value.x).toBe(1);
    expect(value.y).toBe(2);
  });

  it('supports plugins nested in structures', async () => {
    const { value } = await roundtrip<{ vectors: Vector[] }>(
      { vectors: [new Vector(1, 2), new Vector(3, 4)] },
      { serialize: { plugins: PLUGINS }, deserialize: { plugins: PLUGINS } },
    );
    expect(value.vectors[0]).toBeInstanceOf(Vector);
    expect(value.vectors[1].y).toBe(4);
  });

  it('preserves identity of a repeated plugin value', async () => {
    const vector = new Vector(9, 9);
    const { value } = await roundtrip<Vector[]>([vector, vector], {
      serialize: { plugins: PLUGINS },
      deserialize: { plugins: PLUGINS },
    });
    expect(value[0]).toBe(value[1]);
  });

  it('supports asynchronous plugin deserialization', async () => {
    const AsyncVectorPlugin = createPlugin<Vector, SerovalNode, VectorData>({
      ...VectorPlugin,
      binary: {
        serialize: VectorPlugin.binary.serialize,
        async deserialize(value) {
          await Promise.resolve();
          return new Vector(value.x, value.y);
        },
      },
    });
    const { value } = await roundtrip<Vector>(new Vector(5, 6), {
      serialize: { plugins: [AsyncVectorPlugin] },
      deserialize: { plugins: [AsyncVectorPlugin] },
    });
    expect(value).toBeInstanceOf(Vector);
    expect(value.x).toBe(5);
  });

  it('runs cleanups once serialization is done', async () => {
    const cleanup = vi.fn();
    const CleanupPlugin = createPlugin<Vector, SerovalNode, VectorData>({
      ...VectorPlugin,
      binary: {
        serialize(value, ctx) {
          ctx.addCleanup(cleanup);
          return { x: value.x, y: value.y };
        },
        deserialize: VectorPlugin.binary.deserialize,
      },
    });

    const handle = startSerialize(new Vector(1, 2), {
      plugins: [CleanupPlugin],
    });
    await handle.done;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('reports a missing plugin on deserialization', async () => {
    const handle = startSerialize(new Vector(1, 2), { plugins: PLUGINS });
    await handle.done;

    const transport = createTransport();
    const deserialization = binary.deserialize({
      read: () => transport.read(),
      onError(error) {
        throw error;
      },
    });
    for (const chunk of handle.transport.chunks) {
      transport.push(chunk);
    }
    transport.push(undefined);

    await expect(deserialization).rejects.toThrow('Vector');
  });

  it('rejects unsupported values without a plugin', async () => {
    const error = await captureSerializeError(new Vector(1, 2));
    expect(error).toBeInstanceOf(Error);
  });
});
