import { describe, expect, it } from 'vitest';
import {
  compileJSON,
  createPlugin,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  fromJSON,
  Serializer,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalDeserializationError,
  SerovalMissingPluginError,
  SerovalParserError,
  SerovalSerializationError,
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
  expect(error).toBeInstanceOf(SerovalParserError);
  expect((error as SerovalParserError).cause).toBeInstanceOf(
    SerovalDepthLimitError,
  );
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
    for (const entry of [
      serializeAsync,
      toJSONAsync,
      crossSerializeAsync,
      toCrossJSONAsync,
    ]) {
      await expect(entry(createNested(2), OPTIONS)).resolves.toBeDefined();
      expectDepthLimit(await entry(DEEP, OPTIONS).catch(error => error));
    }
  });

  it('is honored by crossSerializeStream', async () => {
    const error = await new Promise<unknown>(resolve => {
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
    const error = await new Promise<unknown>(resolve => {
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
    expect(caught).toBeInstanceOf(SerovalDeserializationError);
    expect((caught as SerovalDeserializationError).cause).toBeInstanceOf(
      SerovalDepthLimitError,
    );
  });
});

describe('SerovalSerializationError', () => {
  const ExamplePlugin = createPlugin<URL, { href: unknown }>({
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
      return 'new URL(' + ctx.serialize(node.href as never) + ')';
    },
    deserialize(node, ctx) {
      return new URL(ctx.deserialize(node.href as never));
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
    expect(caught).toBeInstanceOf(SerovalSerializationError);
    expect((caught as SerovalSerializationError).cause).toBeInstanceOf(
      SerovalMissingPluginError,
    );
  });
});

describe('SerovalConflictedNodeIdError', () => {
  it('reports a node id that is assigned twice', () => {
    const json = JSON.parse(
      '{"t":{"t":9,"i":0,"a":[{"t":9,"i":0,"a":[]}]},"f":127,"m":[0]}',
    );
    let caught: unknown;
    try {
      fromJSON(json);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SerovalDeserializationError);
    expect((caught as SerovalDeserializationError).cause).toBeInstanceOf(
      SerovalConflictedNodeIdError,
    );
  });
});
