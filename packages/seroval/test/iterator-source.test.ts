import { describe, expect, it, vi } from 'vitest';
import {
  createPlugin,
  fromJSON,
  SerovalMalformedNodeError,
  type SerovalObjectNode,
  toJSON,
  toJSONAsync,
} from '../src';

/**
 * A generator serializes as an object holding an IteratorFactoryInstance whose
 * second argument is the backing Sequence (async: a Stream). The deserializer
 * casts that argument to a Sequence/Stream, so a tampered tree that points it
 * at some other node must be rejected instead of type-confused.
 */
function iteratorInstance(node: SerovalObjectNode): { a: unknown[] } {
  return node.p.v[0] as unknown as { a: unknown[] };
}

describe('iterator factory instance source validation', () => {
  it('rejects a sync iterator whose source is not a Sequence', () => {
    function* gen() {
      yield 1;
    }
    const json = toJSON(gen());
    // Aim the sequence slot at a non-Sequence node.
    iteratorInstance(json.t as SerovalObjectNode).a[1] = toJSON(42).t;
    let caught: unknown;
    try {
      fromJSON(json);
    } catch (error) {
      caught = error;
    }
    expect((caught as { cause: unknown }).cause).toBeInstanceOf(
      SerovalMalformedNodeError,
    );
  });

  it('rejects an async iterator whose source is not a Stream', async () => {
    async function* gen() {
      yield 1;
    }
    const json = await toJSONAsync(gen());
    iteratorInstance(json.t as SerovalObjectNode).a[1] = toJSON('nope').t;
    let caught: unknown;
    try {
      fromJSON(json);
    } catch (error) {
      caught = error;
    }
    expect((caught as { cause: unknown }).cause).toBeInstanceOf(
      SerovalMalformedNodeError,
    );
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
      deserialize: () =>
        ({ __SEROVAL_STREAM__: 1, on: onSpy }) as unknown as never,
    });
    // AsyncIteratorFactoryInstance { a: [instance, source] }, source = plugin.
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
        (out as () => unknown)();
      } catch {
        // ignore
      }
    }
    expect(onSpy).not.toHaveBeenCalled();
  });
});
