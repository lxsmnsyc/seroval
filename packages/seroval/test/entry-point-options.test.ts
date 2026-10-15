import { assert, describe, expect, it } from 'vitest';
import {
  Serializer,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalDeserializationError,
  type SerovalJSON,
  SerovalMissingPluginError,
  type SerovalNode,
  SerovalParserError,
  SerovalSerializationError,
  compileJSON,
  createPlugin,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';

function createNested(depth: number): Record<string, unknown> {
  let current: Record<string, unknown> = {};
  const root = current;
  for (let i = 0; i < depth; i++) {
    const next: Record<string, unknown> = {};
    current.child = next;
    current = next;
  }
  return root;
}

const DEEP = createNested(20);
const OPTIONS = { depthLimit: 4 };

function expectDepthLimit(error: unknown): void {
  assert(error instanceof SerovalParserError);
  expect(error.cause).toBeInstanceOf(SerovalDepthLimitError);
}

describe('depthLimit', () => {
  it('is honored by the sync entry points', () => {
    for (const entry of [serialize, toJSON, crossSerialize, toCrossJSON]) {
      expect(() => entry(createNested(2), OPTIONS)).not.toThrow();
      let caught: unknown;
      try {
        entry(DEEP, OPTIONS);
      } catch (error) {
        caught = error;
      }
      expectDepthLimit(caught);
    }
  });

  it('is honored by the async entry points', async () => {
    for (const entry of [serializeAsync, toJSONAsync, crossSerializeAsync, toCrossJSONAsync]) {
      await expect(entry(createNested(2), OPTIONS)).resolves.toBeDefined();
      expectDepthLimit(await entry(DEEP, OPTIONS).catch((error: unknown) => error));
    }
  });

  it('is honored by crossSerializeStream', async () => {
    const error = await new Promise<unknown>((resolve) => {
      crossSerializeStream(DEEP, {
        ...OPTIONS,
        onSerialize() {
          resolve(new Error('serialized past the depth limit'));
        },
        onError: resolve,
      });
    });
    expect(error).toBeInstanceOf(SerovalDepthLimitError);
  });

  it('is honored by Serializer', async () => {
    const error = await new Promise<unknown>((resolve) => {
      const writer = new Serializer({
        ...OPTIONS,
        globalIdentifier: '_$',
        onData() {
          resolve(new Error('serialized past the depth limit'));
        },
        onError: resolve,
      });
      writer.write('deep', DEEP);
    });
    expect(error).toBeInstanceOf(SerovalDepthLimitError);
  });

  it('is honored by fromJSON', () => {
    const json = toJSON(DEEP);
    expect(fromJSON(json)).toEqual(DEEP);
    let caught: unknown;
    try {
      fromJSON(json, OPTIONS);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof SerovalDeserializationError);
    expect(caught.cause).toBeInstanceOf(SerovalDepthLimitError);
  });
});

describe('SerovalSerializationError', () => {
  const ExamplePlugin = createPlugin<URL, { href: SerovalNode }>({
    tag: 'example',
    test(value) {
      return value instanceof URL;
    },
    parse: {
      sync(value, ctx) {
        return { href: ctx.parse(value.href) };
      },
    },
    serialize(node, ctx) {
      return 'new URL(' + ctx.serialize(node.href) + ')';
    },
    deserialize(node, ctx) {
      return new URL(ctx.deserialize(node.href));
    },
  });

  it('wraps failures raised while emitting the output', () => {
    const json = toJSON(new URL('https://example.com/'), {
      plugins: [ExamplePlugin],
    });
    let caught: unknown;
    try {
      compileJSON(json);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof SerovalSerializationError);
    expect(caught.cause).toBeInstanceOf(SerovalMissingPluginError);
  });
});

describe('SerovalConflictedNodeIdError', () => {
  it('reports a node id that is assigned twice', () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the JSON is forged on purpose.
    const json = JSON.parse(
      '{"t":{"t":9,"i":0,"a":[{"t":9,"i":0,"a":[]}]},"f":127,"m":[0]}',
    ) as SerovalJSON;
    let caught: unknown;
    try {
      fromJSON(json);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof SerovalDeserializationError);
    expect(caught.cause).toBeInstanceOf(SerovalConflictedNodeIdError);
  });
});
