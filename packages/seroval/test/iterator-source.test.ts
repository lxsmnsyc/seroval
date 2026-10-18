import { assert, describe, expect, it, vi } from 'vitest';
import {
  SerovalMalformedNodeError,
  type SerovalNode,
  createPlugin,
  fromJSON,
  toJSON,
  toJSONAsync,
} from '../src';
import { SerovalNodeType } from '../src/core/constants';

/**
 * A generator serializes as an object holding an IteratorFactoryInstance whose
 * second argument is the backing Sequence (async: a Stream). The deserializer
 * casts that argument to a Sequence/Stream, so a tampered tree that points it
 * at some other node must be rejected instead of type-confused.
 */
function iteratorInstance(node: SerovalNode): { a: SerovalNode[] } {
  assert(node.t === SerovalNodeType.Object || node.t === SerovalNodeType.NullConstructor);
  const instance = node.p.v[0];
  assert(
    instance.t === SerovalNodeType.IteratorFactoryInstance ||
      instance.t === SerovalNodeType.AsyncIteratorFactoryInstance,
  );
  return instance;
}

describe('iterator factory instance source validation', () => {
  it('rejects a sync iterator whose source is not a Sequence', () => {
    function* gen(): Generator<number> {
      yield 1;
    }
    const json = toJSON(gen());
    // Aim the sequence slot at a non-Sequence node.
    iteratorInstance(json.t).a[1] = toJSON(42).t;
    let caught: unknown;
    try {
      fromJSON(json);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    expect(caught.cause).toBeInstanceOf(SerovalMalformedNodeError);
  });

  it('rejects an async iterator whose source is not a Stream', async () => {
    // oxlint-disable-next-line typescript/require-await -- the generator must be async to use a Stream source.
    async function* gen(): AsyncGenerator<number> {
      yield 1;
    }
    const json = await toJSONAsync(gen());
    iteratorInstance(json.t).a[1] = toJSON('nope').t;
    let caught: unknown;
    try {
      fromJSON(json);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    expect(caught.cause).toBeInstanceOf(SerovalMalformedNodeError);
  });

  it('rejects a plugin-forged branded stream as an async iterator source', () => {
    // A plugin can return an object carrying the `__SEROVAL_STREAM__` brand, so
    // a runtime brand check is not enough. The source node type (Plugin, not
    // StreamConstructor) is what must be rejected, before its `on` is invoked.
    const onSpy = vi.fn();
    const fakeStreamPlugin = createPlugin<unknown, Record<string, never>>({
      tag: 'test/fake-stream',
      test: () => false,
      parse: { sync: () => ({}) },
      serialize: () => '',
      deserialize: () => ({ __SEROVAL_STREAM__: 1, on: onSpy }),
    });
    // AsyncIteratorFactoryInstance { a: [instance, source] }, source = plugin.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the JSON is forged on purpose.
    const json = {
      t: {
        t: 30,
        a: [
          { t: 4, i: 0 },
          { t: 25, i: 1, c: 'test/fake-stream', s: {} },
        ],
      },
      f: 0x7f,
      m: [1],
    } as unknown as Parameters<typeof fromJSON>[0];

    const out = (() => {
      try {
        return fromJSON(json, { plugins: [fakeStreamPlugin] });
      } catch {
        return undefined;
      }
    })();
    // Even if a build ever returned a factory, invoking it must not call `on`.
    if (typeof out === 'function') {
      try {
        Reflect.apply(out, undefined, []);
      } catch {
        // ignore
      }
    }
    expect(onSpy).not.toHaveBeenCalled();
  });
});
