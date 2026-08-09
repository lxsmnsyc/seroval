import { binary } from '../../src';

/**
 * A minimal in-memory transport that models the stream the binary format
 * is meant to travel through: the serializer pushes chunks as they are
 * produced, the deserializer pulls them one at a time and blocks on an
 * unresolved read until the next chunk (or the end-of-stream marker)
 * arrives.
 */
export interface Transport {
  push(chunk: Uint8Array | undefined): void;
  read(): Promise<Uint8Array | undefined>;
  chunks: Uint8Array[];
}

export function createTransport(): Transport {
  const queue: (Uint8Array | undefined)[] = [];
  const chunks: Uint8Array[] = [];
  const readers: ((chunk: Uint8Array | undefined) => void)[] = [];

  return {
    chunks,
    push(chunk) {
      if (chunk) {
        chunks.push(chunk);
      }
      const reader = readers.shift();
      if (reader) {
        reader(chunk);
      } else {
        queue.push(chunk);
      }
    },
    read() {
      if (queue.length > 0) {
        return Promise.resolve(queue.shift());
      }
      return new Promise(resolve => {
        readers.push(resolve);
      });
    },
  };
}

export interface SerializeHandle {
  /** Resolves once the serializer has flushed everything. */
  done: Promise<void>;
  /** Aborts the serialization early. */
  abort: () => void;
  transport: Transport;
}

export function startSerialize(
  value: unknown,
  options?: Partial<binary.SerializeOptions>,
): SerializeHandle {
  const transport = createTransport();
  let resolveDone!: () => void;
  let rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const abort = binary.serialize(value, {
    refs: new Map(),
    ...options,
    onSerialize(bytes) {
      transport.push(bytes);
    },
    onDone() {
      transport.push(undefined);
      resolveDone();
    },
    onError(error) {
      rejectDone(error);
    },
  });

  return { done, abort, transport };
}

export function startDeserialize<T>(
  transport: Transport,
  options?: Partial<binary.DeserializeOptions>,
): Promise<{ value: T }> {
  return binary.deserialize<T>({
    read: () => transport.read(),
    onError(error) {
      throw error;
    },
    ...options,
  });
}

/**
 * Serializes `value` and deserializes it back through a live stream.
 * The returned value is resolved as soon as the root node is decoded,
 * which for a `Promise` root happens before that promise settles.
 */
/**
 * Runs the serializer alone and resolves with the error it reported, or
 * `undefined` when it completed. Serialization failures never produce a
 * root node, so `roundtrip` would hang on them.
 */
export function captureSerializeError(
  value: unknown,
  options?: Partial<binary.SerializeOptions>,
): Promise<unknown> {
  return startSerialize(value, options).done.then(
    () => undefined,
    error => error,
  );
}

export async function roundtrip<T>(
  value: unknown,
  options?: {
    serialize?: Partial<binary.SerializeOptions>;
    deserialize?: Partial<binary.DeserializeOptions>;
  },
): Promise<{ value: T; done: Promise<void> }> {
  const handle = startSerialize(value, options?.serialize);
  const result = await startDeserialize<T>(handle.transport, options?.deserialize);
  return { value: result.value, done: handle.done };
}
