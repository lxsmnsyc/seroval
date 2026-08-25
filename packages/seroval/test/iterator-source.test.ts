import { describe, expect, it } from 'vitest';
import {
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
});
