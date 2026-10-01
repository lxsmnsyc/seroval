import { describe, expect, it } from 'vitest';
import { createReference } from '../../src';
import { roundtrip, startDeserialize, startSerialize } from './utils';

describe('binary references', () => {
  it('sends a registered function by its key', async () => {
    const fn = createReference('binary-reference-fn', () => 'hello');
    const { value } = await roundtrip<{ fn: () => string }>({ fn });
    expect(value.fn).toBe(fn);
    expect(value.fn()).toBe('hello');
  });

  it('sends a registered object and symbol by their keys', async () => {
    const object = createReference('binary-reference-object', { a: 1 });
    const symbol = createReference('binary-reference-symbol', Symbol('s'));
    const { value } = await roundtrip<{ object: object; symbol: symbol }>({
      object,
      symbol,
    });
    expect(value.object).toBe(object);
    expect(value.symbol).toBe(symbol);
  });

  it('keeps the identity of a reference used twice', async () => {
    const fn = createReference('binary-reference-twice', () => 1);
    const { value } = await roundtrip<[() => number, () => number]>([fn, fn]);
    expect(value[0]).toBe(fn);
    expect(value[1]).toBe(fn);
  });

  it('rejects a key that is not registered on the receiving side', async () => {
    const fn = createReference('binary-reference-missing', () => 1);
    const handle = startSerialize({ fn });
    await handle.done;
    // Rewrite the key so the receiver does not know it.
    const encoder = new TextEncoder();
    const original = encoder.encode('binary-reference-missing');
    const replaced = encoder.encode('binary-reference-unknown');
    const chunks = handle.transport.chunks.map(chunk => {
      for (let i = 0; i + original.length <= chunk.length; i++) {
        if (original.every((byte, j) => chunk[i + j] === byte)) {
          const copy = chunk.slice();
          copy.set(replaced, i);
          return copy;
        }
      }
      return chunk;
    });
    let index = 0;
    const errors: unknown[] = [];
    const result = startDeserialize(
      { read: () => Promise.resolve(chunks[index++]) } as never,
      {
        onError(error) {
          errors.push(error);
        },
      },
    );
    await expect(result).rejects.toBeInstanceOf(Error);
    expect(errors).toHaveLength(1);
  });
});
