import { describe, expect, it, vi } from 'vitest';
import * as binary from '../../src/binary';
import {
  type PluginWithBinaryMode,
  type SerovalNode,
  SerovalPluginValidationError,
  createPlugin,
  v,
} from '../../src';
import { captureSerializeError, createTransport, roundtrip, startSerialize } from './utils';

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

  describe('materialization', () => {
    // A plugin whose value only exists after a Promise node settles is the
    // sharpest test of "the root is handed over complete": every container in
    // between has to wait, at any depth and whatever its kind.
    const SlowVectorPlugin = createPlugin<Vector, SerovalNode, VectorData>({
      ...VectorPlugin,
      binary: {
        serialize(value) {
          return { x: value.x, y: value.y };
        },
        async deserialize(value) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return new Vector(value.x, value.y);
        },
      },
    });
    const SLOW = {
      serialize: { plugins: [SlowVectorPlugin] },
      deserialize: { plugins: [SlowVectorPlugin] },
    };

    it('hands over a directly nested plugin value', async () => {
      const { value } = await roundtrip<{ v: Vector }>({ v: new Vector(1, 2) }, SLOW);
      expect(value.v).toBeInstanceOf(Vector);
    });

    it('hands over a deeply nested plugin value', async () => {
      const { value } = await roundtrip<{ a: { b: Vector[] } }>(
        { a: { b: [new Vector(3, 4)] } },
        SLOW,
      );
      expect(value.a.b[0]).toBeInstanceOf(Vector);
      expect(value.a.b[0].x).toBe(3);
    });

    it('hands over plugin values inside a Map', async () => {
      const { value } = await roundtrip<Map<string, Vector>>(
        new Map([['v', new Vector(5, 6)]]),
        SLOW,
      );
      expect(value.size).toBe(1);
      expect(value.get('v')).toBeInstanceOf(Vector);
    });

    it('hands over plugin values inside a Set', async () => {
      const { value } = await roundtrip<Set<Vector>>(new Set([new Vector(7, 8)]), SLOW);
      expect(value.size).toBe(1);
      expect([...value][0]).toBeInstanceOf(Vector);
    });

    it('hands over a Map at the root fully populated', async () => {
      const { value } = await roundtrip<Map<string, number>>(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
        SLOW,
      );
      expect(value.size).toBe(2);
    });

    it('hands over a plugin payload containing another plugin value', async () => {
      class Envelope {
        constructor(public inner: Vector) {}
      }
      const OuterPlugin = createPlugin<Envelope, SerovalNode, { inner: Vector }>({
        tag: 'Outer',
        test: (value) => value instanceof Envelope,
        parse: { sync: (value, ctx) => ctx.parse(value.inner) },
        serialize: (node, ctx) => ctx.serialize(node),
        deserialize: () => new Envelope(new Vector(0, 0)),
        binary: {
          serialize: (value) => ({ inner: value.inner }),
          // Copies its payload the way the web plugins do.
          deserialize: (value) => new Envelope(value.inner),
        },
      });
      const plugins = [OuterPlugin, SlowVectorPlugin];

      const { value } = await roundtrip<Envelope>(new Envelope(new Vector(9, 9)), {
        serialize: { plugins },
        deserialize: { plugins },
      });
      expect(value).toBeInstanceOf(Envelope);
      expect(value.inner).toBeInstanceOf(Vector);
      expect(value.inner.x).toBe(9);
    });

    it('does not deadlock on a payload that references its own value', async () => {
      // The payload holds the very value the plugin is building, so the
      // container can never settle. The wait has to step over it.
      class Node {
        marker = 'node';
      }
      const SelfPlugin = createPlugin<Node, SerovalNode, { self: Node }>({
        tag: 'Self',
        test: (value) => value instanceof Node,
        parse: { sync: (value, ctx) => ctx.parse(value.marker) },
        serialize: (node, ctx) => ctx.serialize(node),
        deserialize: () => new Node(),
        binary: {
          serialize: (value) => ({ self: value }),
          deserialize: () => new Node(),
        },
      });
      const plugins = [SelfPlugin];
      const errors: unknown[] = [];

      const settled = await Promise.race([
        roundtrip<Node>(new Node(), {
          serialize: { plugins },
          deserialize: {
            plugins,
            onError(error) {
              errors.push(error);
            },
          },
        }).then((result) => result.value),
        new Promise((resolve) => setTimeout(() => resolve('deadlock'), 200)),
      ]);
      expect(settled).toBeInstanceOf(Node);
      // The back-reference itself cannot be satisfied - the id is only
      // registered when the Plugin node is read - so it is reported, not hung.
      expect(errors[0]).toBeInstanceOf(Error);
    });
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

type BinaryOnlyPlugin<Value, BinaryData> = PluginWithBinaryMode<
  Value,
  Record<string, never>,
  BinaryData
>;

// A plugin for binary mode only. The other modes are not used by these tests.
function createBinaryPlugin<Value, BinaryData>(
  tag: string,
  test: (value: unknown) => boolean,
  section: BinaryOnlyPlugin<Value, BinaryData>['binary'],
  skipPlainObjects?: boolean,
): BinaryOnlyPlugin<Value, BinaryData> {
  return createPlugin<Value, Record<string, never>, BinaryData>({
    tag,
    skipPlainObjects,
    test,
    parse: {},
    serialize: () => '',
    deserialize: () => {
      throw new Error('Not used in binary mode.');
    },
    binary: section,
  });
}

describe('binary Plugin validate', () => {
  const isVector = (value: unknown): boolean => value instanceof Vector;
  const deserialized = vi.fn();
  const CheckedPlugin = createBinaryPlugin<Vector, VectorData>('Vector', isVector, {
    serialize: (value) => ({ x: value.x, y: value.y }),
    validate: { x: v.number, y: v.number },
    deserialize(value) {
      deserialized(value);
      return new Vector(value.x, value.y);
    },
  });
  // The sender lies about the payload: `x` is a string instead of a number.
  const ForgedPlugin = createBinaryPlugin<Vector, unknown>('Vector', isVector, {
    serialize: (value) => ({ x: String(value.x), y: value.y }),
    deserialize: () => new Vector(0, 0),
  });
  const NumberPlugin = createBinaryPlugin<Vector, unknown>('Vector', isVector, {
    serialize: () => 42,
    deserialize: () => new Vector(0, 0),
  });

  async function decode(
    // oxlint-disable-next-line no-explicit-any -- Plugin is invariant, so any is needed to hold every plugin.
    plugin: PluginWithBinaryMode<any, any, any>,
  ): Promise<{ ok: boolean; error?: unknown }> {
    const handle = startSerialize(new Vector(1, 2), { plugins: [plugin] });
    handle.done.catch(() => undefined);
    try {
      await binary.deserialize<Vector>({
        read: async () => await handle.transport.read(),
        plugins: [CheckedPlugin],
        onError() {},
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  it('accepts a payload whose fields pass', async () => {
    deserialized.mockClear();
    expect(await decode(CheckedPlugin)).toEqual({ ok: true });
    expect(deserialized).toHaveBeenCalledWith({ x: 1, y: 2 });
  });

  it('rejects a field before deserialize runs', async () => {
    deserialized.mockClear();
    const result = await decode(ForgedPlugin);
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(SerovalPluginValidationError);
    expect(result.error).toMatchObject({ tag: 'Vector', field: 'x' });
    expect(deserialized).not.toHaveBeenCalled();
  });

  it('rejects a payload that is not an object', async () => {
    const result = await decode(NumberPlugin);
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ field: 'x' });
  });
});

describe('binary Plugin skipPlainObjects', () => {
  // Matches every object with `x`, plain or not. The payload is an array, so
  // the plugin does not match its own payload.
  function createPointPlugin(skipPlainObjects: boolean): {
    plugin: BinaryOnlyPlugin<{ x: number }, [number]>;
    test: ReturnType<typeof vi.fn>;
  } {
    const test = vi.fn(
      (value: unknown): boolean => typeof value === 'object' && value !== null && 'x' in value,
    );
    const plugin = createBinaryPlugin<{ x: number }, [number]>(
      'Point',
      test,
      {
        serialize: (value) => [value.x],
        deserialize: (data) => new Vector(data[0], 0),
      },
      skipPlainObjects,
    );
    return { plugin, test };
  }

  function LegacyPoint(this: { x: number }, x: number): void {
    this.x = x;
  }
  LegacyPoint.prototype = { kind: 'legacy' };

  it('skips plain objects only', async () => {
    const { plugin, test } = createPointPlugin(true);
    // oxlint-disable-next-line no-unsafe-type-assertion -- Calls the legacy constructor with `new`.
    const legacy = new (LegacyPoint as unknown as new (x: number) => { x: number })(3);
    const ownConstructor: unknown = JSON.parse('{"constructor":2,"x":4}');
    const source = [{ x: 1 }, new Vector(2, 0), legacy, ownConstructor];
    const { value } = await roundtrip<unknown[]>(source, {
      serialize: { plugins: [plugin] },
      deserialize: { plugins: [plugin] },
    });
    expect(value[0]).toEqual({ x: 1 });
    expect(value[0]).not.toBeInstanceOf(Vector);
    expect(value[1]).toBeInstanceOf(Vector);
    expect(value[2]).toBeInstanceOf(Vector);
    expect(value[3]).toEqual({ constructor: 2, x: 4 });
    expect(test).not.toHaveBeenCalledWith(source[0]);
  });

  it('tests plain objects by default', async () => {
    const { plugin } = createPointPlugin(false);
    const { value } = await roundtrip<unknown[]>([{ x: 1 }], {
      serialize: { plugins: [plugin] },
      deserialize: { plugins: [plugin] },
    });
    expect(value[0]).toBeInstanceOf(Vector);
  });
});
