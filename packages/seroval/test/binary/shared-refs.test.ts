import { describe, expect, it } from 'vitest';
import { binary } from '../../src';

function send(value: unknown, refs: Map<unknown, Uint8Array>) {
  return new Promise<Uint8Array[]>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    binary.serialize(value, {
      refs,
      onSerialize(bytes) {
        chunks.push(bytes);
      },
      onDone: () => resolve(chunks),
      onError: reject,
    });
  });
}

function receive<T>(chunks: Uint8Array[], refs: binary.ReferenceMap) {
  let index = 0;
  return binary.deserialize<T>({
    refs,
    read: () => Promise.resolve(chunks[index++]),
    onError(error) {
      throw error;
    },
  });
}

describe('binary shared references', () => {
  it('resolves a value sent in an earlier payload', async () => {
    const serializerRefs = new Map<unknown, Uint8Array>();
    const deserializerRefs = binary.createReferenceMap();
    const shared = { name: 'shared' };

    const first = await receive<{ a: typeof shared }>(
      await send({ a: shared }, serializerRefs),
      deserializerRefs,
    );
    const second = await receive<{ b: typeof shared }>(
      await send({ b: shared }, serializerRefs),
      deserializerRefs,
    );
    expect(second.value.b).toBe(first.value.a);
    expect(second.value.b).toEqual({ name: 'shared' });
  });
});
