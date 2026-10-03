import { describe, expect, it, vi } from 'vitest';
import { binary, createStream, type Stream } from '../../src';
import { roundtrip } from './utils';

/**
 * Hostile payloads for the checks the decoder makes on ids, containers,
 * sequences, promises, streams and views. Little endian, like the preamble.
 */
function u32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, true);
  return new Uint8Array(buffer);
}

function i32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setInt32(0, value, true);
  return new Uint8Array(buffer);
}

function f64(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  return new Uint8Array(buffer);
}

function node(...parts: (number | Uint8Array)[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += typeof part === 'number' ? 1 : part.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      result[offset++] = part;
    } else {
      result.set(part, offset);
      offset += part.length;
    }
  }
  return result;
}

const preamble = () => node(0, 1);
const root = (id: number) => node(1, u32(id));
const numberNode = (id: number, value: number) => node(3, u32(id), f64(value));
const stringNode = (id: number, value: string) => {
  const encoded = new TextEncoder().encode(value);
  return node(4, u32(id), u32(encoded.length), encoded);
};
const objectAssign = (id: number, key: number, value: number) =>
  node(7, u32(id), u32(key), u32(value));
const arrayNode = (id: number, length: number) =>
  node(10, u32(id), u32(length));
const arrayAssign = (id: number, index: number, value: number) =>
  node(8, u32(id), u32(index), u32(value));
const streamNode = (id: number) => node(11, u32(id), 0);
const streamNext = (id: number, value: number) =>
  node(12, u32(id), u32(value));
const streamReturn = (id: number, value: number) =>
  node(14, u32(id), u32(value));
const sequenceNode = (id: number, throwAt: number, doneAt: number) =>
  node(15, u32(id), i32(throwAt), i32(doneAt));
const sequencePush = (id: number, value: number) =>
  node(16, u32(id), u32(value));
const objectNode = (id: number) => node(18, u32(id));
const arrayBufferNode = (id: number, bytes: Uint8Array) =>
  node(23, u32(id), u32(bytes.length), bytes);
const typedArrayNode = (
  id: number,
  buffer: number,
  offset: number,
  length: number,
) => node(24, u32(id), 4, u32(buffer), u32(offset), u32(length));
const promiseNode = (id: number) => node(31, u32(id));
const promiseSuccess = (id: number, value: number) =>
  node(32, u32(id), u32(value));
const iteratorNode = (id: number, sequence: number) =>
  node(36, u32(id), u32(sequence));
const pending = (id: number, amount: number) =>
  node(38, u32(id), u32(amount));

function feed(chunks: Uint8Array[]) {
  const errors: unknown[] = [];
  let index = 0;
  const value = binary.deserialize<unknown>({
    read: () => Promise.resolve(chunks[index++]),
    onError(error) {
      errors.push(error);
    },
  });
  const settled = value.then(
    result => ({ status: 'resolved' as const, value: result.value }),
    error => ({ status: 'rejected' as const, error }),
  );
  return { settled, errors };
}

describe('binary decoder checks', () => {
  it('rejects a redeclared id', async () => {
    const { settled } = feed([
      preamble(),
      promiseNode(1),
      numberNode(1, 1),
      root(1),
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('rejects a sequence whose done index is past its values', async () => {
    const { settled } = feed([
      preamble(),
      sequenceNode(1, -1, 0x7fffffff),
      pending(1, 0),
      iteratorNode(2, 1),
      root(2),
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('rejects a sequence whose Pending amount does not match its values', async () => {
    const { settled } = feed([
      preamble(),
      numberNode(2, 1),
      sequenceNode(1, -1, 1),
      sequencePush(1, 2),
      pending(1, 2),
      iteratorNode(3, 1),
      root(3),
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('rejects an iterator over a sequence that is still open', async () => {
    const { settled } = feed([
      preamble(),
      numberNode(2, 1),
      sequenceNode(1, -1, 0),
      sequencePush(1, 2),
      iteratorNode(3, 1),
      pending(1, 1),
      root(3),
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('accepts a valid sequence', async () => {
    const { settled } = feed([
      preamble(),
      numberNode(2, 1),
      node(2, u32(4), 1),
      sequenceNode(1, -1, 1),
      sequencePush(1, 2),
      sequencePush(1, 4),
      pending(1, 2),
      iteratorNode(3, 1),
      root(3),
      undefined as unknown as Uint8Array,
    ]);
    const result = await settled;
    expect(result.status).toBe('resolved');
    const factory = (result as { value: () => Iterator<number> }).value;
    expect([...{ [Symbol.iterator]: factory }]).toEqual([1]);
  });

  it('rejects an assignment after the container was closed', async () => {
    const { settled } = feed([
      preamble(),
      stringNode(2, 'a'),
      numberNode(3, 1),
      objectNode(1),
      pending(1, 0),
      objectAssign(1, 2, 3),
      root(1),
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('rejects a second Pending for the same container', async () => {
    const { settled } = feed([
      preamble(),
      objectNode(1),
      pending(1, 0),
      pending(1, 0),
      root(1),
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('rejects a promise that settles with itself', async () => {
    const { settled } = feed([
      preamble(),
      promiseNode(1),
      root(1),
      promiseSuccess(1, 1),
    ]);
    const result = await settled;
    if (result.status === 'resolved') {
      await expect(result.value as Promise<unknown>).rejects.toBeInstanceOf(
        Error,
      );
    } else {
      expect(result.status).toBe('rejected');
    }
  });

  it('rejects a promise that settles with another promise', async () => {
    const { settled } = feed([
      preamble(),
      promiseNode(2),
      promiseNode(1),
      root(1),
      promiseSuccess(1, 2),
    ]);
    const result = await settled;
    if (result.status === 'resolved') {
      await expect(result.value as Promise<unknown>).rejects.toBeInstanceOf(
        Error,
      );
    } else {
      expect(result.status).toBe('rejected');
    }
  });

  it('rejects a second settle node for the same promise', async () => {
    const { settled, errors } = feed([
      preamble(),
      numberNode(2, 1),
      promiseNode(1),
      root(1),
      promiseSuccess(1, 2),
      promiseSuccess(1, 2),
    ]);
    const result = await settled;
    expect(result.status).toBe('resolved');
    await vi.waitFor(() => {
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('rejects a stream event after the stream ended', async () => {
    const { settled, errors } = feed([
      preamble(),
      numberNode(2, 1),
      streamNode(1),
      root(1),
      streamReturn(1, 2),
      streamNext(1, 2),
    ]);
    const result = await settled;
    expect(result.status).toBe('resolved');
    await vi.waitFor(() => {
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('rejects a typed array outside its buffer as malformed', async () => {
    const { settled, errors } = feed([
      preamble(),
      arrayBufferNode(1, new Uint8Array(4)),
      typedArrayNode(2, 1, 8, 4),
      root(2),
    ]);
    expect((await settled).status).toBe('rejected');
    expect((errors[0] as Error).message).toMatch(/TypedArray/);
  });

  it('rejects the root on a truncated payload', async () => {
    const full = stringNode(1, 'hello');
    const { settled } = feed([
      preamble(),
      full.subarray(0, full.length - 2),
      undefined as unknown as Uint8Array,
    ]);
    expect((await settled).status).toBe('rejected');
  });

  it('rejects the root when a container never gets its Pending', async () => {
    const { settled } = feed([
      preamble(),
      arrayNode(1, 1),
      numberNode(2, 1),
      arrayAssign(1, 0, 2),
      root(1),
      undefined as unknown as Uint8Array,
    ]);
    expect((await settled).status).toBe('rejected');
  });
});

describe('binary decoder value handling', () => {
  it('passes promise values on a stream through without adopting them', async () => {
    const source = createStream<Promise<number>>();
    source.next(Promise.resolve(1));
    source.return(Promise.resolve(2));
    const { value } = await roundtrip<Stream<Promise<number>>>(source);
    const seen: unknown[] = [];
    await new Promise<void>(resolve => {
      value.on({
        next: v => seen.push(v),
        throw: () => resolve(),
        return: v => {
          seen.push(v);
          resolve();
        },
      });
    });
    expect(seen[0]).toBeInstanceOf(Promise);
    expect(seen[1]).toBeInstanceOf(Promise);
    await expect(seen[0]).resolves.toBe(1);
  });

  it('decodes a payload split into one-byte chunks', async () => {
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      binary.serialize(
        { text: 'x'.repeat(2000), list: [1, 2, 3] },
        {
          refs: new Map(),
          onSerialize: bytes => {
            chunks.push(bytes);
          },
          onDone: resolve,
          onError: reject,
        },
      );
    });
    const bytes: Uint8Array[] = [];
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        bytes.push(chunk.subarray(i, i + 1));
      }
    }
    let index = 0;
    const result = await binary.deserialize<{ text: string; list: number[] }>({
      read: () => Promise.resolve(bytes[index++]),
      onError(error) {
        throw error;
      },
    });
    expect(result.value.text).toHaveLength(2000);
    expect(result.value.list).toEqual([1, 2, 3]);
  });
});
