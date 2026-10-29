import fc from 'fast-check';
import * as binary from '../src/binary';

/** How long a round trip may take before it counts as hung. */
const SETTLE_TIMEOUT = 5000;

/** Rejects if `promise` does not settle in time, so a hang fails the property. */
export async function settleWithin<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not settle`)), SETTLE_TIMEOUT);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Serializes a value and joins the chunks into one byte array. */
export async function encode(value: unknown): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const done = new Promise<void>((resolve, reject) => {
    binary.serialize(value, {
      refs: new Map(),
      onSerialize(bytes) {
        chunks.push(bytes.slice());
      },
      onDone: resolve,
      onError: reject,
    });
  });
  await settleWithin(done, 'serialize');
  let length = 0;
  for (const chunk of chunks) {
    length += chunk.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Where to cut the bytes into chunks, as fractions of the length. A transport
 * may split the stream anywhere, including inside a node.
 */
export const cutsArb = fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { maxLength: 8 });

/** Cuts the bytes into chunks at the given fractions of the length. */
export function split(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
  const offsets: number[] = [];
  for (const cut of cuts) {
    offsets.push(Math.floor(cut * bytes.length));
  }
  offsets.sort((a, b) => a - b);
  const chunks: Uint8Array[] = [];
  let start = 0;
  for (const offset of offsets) {
    if (offset > start) {
      chunks.push(bytes.slice(start, offset));
      start = offset;
    }
  }
  if (start < bytes.length) {
    chunks.push(bytes.slice(start));
  }
  return chunks;
}

/** Decodes the chunks, then reports the end of the stream on every later read. */
export function decode<T>(
  chunks: Uint8Array[],
  options: Omit<binary.DeserializeOptions, 'read'>,
): Promise<{ value: T }> {
  let index = 0;
  return binary.deserialize<T>({
    ...options,
    read() {
      return Promise.resolve(index < chunks.length ? chunks[index++] : undefined);
    },
  });
}
