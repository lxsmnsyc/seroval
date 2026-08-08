import { binary } from 'seroval';

/**
 * In-memory transport modelling the stream the binary format travels through:
 * the serializer pushes chunks as they are produced, the deserializer pulls
 * them one at a time and blocks until the next chunk (or end-of-stream).
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

// biome-ignore lint/suspicious/noExplicitAny: plugins are heterogeneous
export type AnyPlugin = any;

export interface SerializeHandle {
  done: Promise<void>;
  abort: () => void;
  transport: Transport;
}

export function startSerialize(
  value: unknown,
  plugins: AnyPlugin[],
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
    plugins,
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
  plugins: AnyPlugin[],
): Promise<{ value: T }> {
  return binary.deserialize<T>({
    read: () => transport.read(),
    plugins,
    onError(error) {
      throw error;
    },
  });
}

/**
 * Serializes and deserializes through a live stream. The value is resolved as
 * soon as the root node is decoded, which for streaming payloads happens
 * before the source has finished producing.
 */
export async function roundtrip<T>(
  value: unknown,
  plugins: AnyPlugin[],
): Promise<{ value: T; done: Promise<void> }> {
  const handle = startSerialize(value, plugins);
  const result = await startDeserialize<T>(handle.transport, plugins);
  return { value: result.value, done: handle.done };
}

/** Resolves with the error the serializer reported, or undefined on success. */
export function captureSerializeError(
  value: unknown,
  plugins: AnyPlugin[],
): Promise<unknown> {
  return startSerialize(value, plugins).done.then(
    () => undefined,
    error => error,
  );
}

/**
 * Hand-rolled node encoders. The serializer can only produce well-formed
 * streams, so hostile payloads have to be written byte by byte. Little endian,
 * matching the preamble below.
 */
export function u32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, true);
  return new Uint8Array(buffer);
}

export function node(...parts: (number | Uint8Array)[]): Uint8Array {
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

export const TYPE = {
  Preamble: 0,
  Root: 1,
  Constant: 2,
  String: 4,
  ObjectAssign: 7,
  Plugin: 17,
  Object: 18,
  Pending: 38,
} as const;

export const CONSTANT = { Null: 0, Undefined: 1, True: 2, False: 3 } as const;

export const preamble = () => node(TYPE.Preamble, 1);
export const constant = (id: number, tag: number) =>
  node(TYPE.Constant, u32(id), tag);
export const stringNode = (id: number, value: string) => {
  const encoded = new TextEncoder().encode(value);
  return node(TYPE.String, u32(id), u32(encoded.length), encoded);
};
export const objectNode = (id: number) => node(TYPE.Object, u32(id));
export const objectAssign = (id: number, key: number, value: number) =>
  node(TYPE.ObjectAssign, u32(id), u32(key), u32(value));
export const pending = (id: number, amount: number) =>
  node(TYPE.Pending, u32(id), u32(amount));
export const pluginNode = (id: number, tag: number, options: number) =>
  node(TYPE.Plugin, u32(id), u32(tag), u32(options));
export const root = (id: number) => node(TYPE.Root, u32(id));

export interface Attempt {
  value: Promise<{ value: unknown }>;
  errors: unknown[];
}

/** Feeds a hand-built payload and collects every error it produces. */
export function feed(chunks: Uint8Array[], plugins: AnyPlugin[]): Attempt {
  const transport = createTransport();
  const errors: unknown[] = [];
  const value = binary.deserialize<unknown>({
    read: () => transport.read(),
    plugins,
    onError(error) {
      errors.push(error);
    },
  });
  // A node that fails while constructing a value rejects the ref it owns,
  // which surfaces on the root rather than through `onError`.
  value.catch(error => {
    errors.push(error);
  });
  for (const chunk of chunks) {
    transport.push(chunk);
  }
  transport.push(undefined);
  return { value, errors };
}
