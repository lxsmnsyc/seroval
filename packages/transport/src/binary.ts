import type { DeserializerOptions, DeserializerPayload, SerializeOptions } from 'seroval/binary';
import { createDeserializer, serialize } from 'seroval/binary';
import type { Reader, ReaderOptions, ValueReader } from './create-reader';
import { createReader, createValueReader } from './create-reader';
import type { Writer, WriterOptions } from './create-writer';
import { createWriter } from './create-writer';
import { SerovalTransportError } from './message';

export type { Message } from './message';
export { SerovalTransportError } from './message';
export type { Reader, ReaderOptions, ValueReader } from './create-reader';
export type { MessageSink, Writer, WriterOptions } from './create-writer';

export interface BinaryWriterOptions
  extends
    Omit<SerializeOptions, 'onSerialize' | 'onDone' | 'onError' | 'refs'>,
    WriterOptions<Uint8Array> {
  /**
   * Shares one set of references across every value, so a later value can
   * refer to an earlier one. The references are then kept until the writer
   * is done. By default, each value has its own and frees them when it is
   * done. The reader must use the same setting.
   */
  sharedRefs?: boolean;
}

export interface BinaryReaderOptions extends Omit<DeserializerOptions, 'onError'>, ReaderOptions {
  /** Shares one set of references across every value. Match the writer. */
  sharedRefs?: boolean;
  /**
   * Receives an error that stopped a value after its message was read, such
   * as a plugin whose `deserialize` failed. The value and what still waits
   * in it fail with the error. Bytes that do not decode make `push` throw.
   */
  onError?: (error: unknown, key: string) => void;
}

/**
 * Creates a writer that sends each value in seroval's binary format, as
 * bytes. Read the messages with `createBinaryReader`. The frames of
 * `encodeFrame` carry the bytes as they are, without JSON.
 */
export function createBinaryWriter(options: BinaryWriterOptions): Writer {
  const shared = options.sharedRefs ? new Map<unknown, number>() : undefined;
  return createWriter<Uint8Array>(options, (value, callbacks) => {
    let initial = true;
    // seroval ignores the writer's own options, such as `send`. A value that
    // fails sends the bytes it wrote before `onError`, so a later value can
    // refer to them.
    return serialize(value, {
      ...options,
      refs: shared ?? new Map(),
      onSerialize(bytes) {
        const first = initial;
        initial = false;
        return callbacks.onData(bytes, first);
      },
      onDone: callbacks.onDone,
      onError: callbacks.onError,
    });
  });
}

interface Entry {
  payload: DeserializerPayload<unknown>;
  // The error that stopped the payload after `push` or `end` returned.
  failure: { error: unknown } | undefined;
}

function assertBytes(data: unknown): asserts data is Uint8Array {
  if (!(data instanceof Uint8Array)) {
    throw new SerovalTransportError('The transport received a malformed message.');
  }
}

/**
 * Creates a reader of the messages of `createBinaryWriter`. It never runs
 * code from the messages. Each message is decoded before `push` returns, so
 * values that share references decode in the order the writer sent them.
 */
export function createBinaryReader(options: BinaryReaderOptions = {}): Reader {
  const { sharedRefs, maxKeys, onError, ...deserializer } = options;
  const shared = sharedRefs ? createDeserializer(deserializer) : undefined;
  // The payload of each key until its value is decoded or stopped. One that
  // failed stays until the writer ends it, so `done` can reject.
  const entries = new Map<string, Entry>();

  function forget(key: string, entry: Entry): void {
    if (entries.get(key) === entry) {
      entries.delete(key);
    }
  }

  function stopPayload(key: string, reason: unknown): void {
    const entry = entries.get(key);
    if (entry) {
      entries.delete(key);
      entry.payload.abort(reason);
    }
  }

  return createReader(
    {
      open(key, data) {
        assertBytes(data);
        const session = shared ?? createDeserializer(deserializer);
        const entry: Entry = {
          payload: session.open({
            onError(error) {
              entry.failure = { error };
              onError?.(error, key);
            },
          }),
          failure: undefined,
        };
        entries.set(key, entry);
        try {
          entry.payload.push(data);
        } catch (error) {
          forget(key, entry);
          throw error;
        }
        return entry.payload.result.then((result) => result.value);
      },
      next(key, data) {
        assertBytes(data);
        entries.get(key)?.payload.push(data);
      },
      done(key) {
        const entry = entries.get(key);
        if (!entry) {
          return undefined;
        }
        let finished: Promise<void>;
        if (entry.failure) {
          finished = Promise.reject(entry.failure.error);
        } else {
          try {
            entry.payload.end();
            // The writer sent every byte. Settle once the root and the
            // containers in it are filled in, after the last byte.
            finished = entry.payload.result.then(() => undefined);
          } catch (error) {
            onError?.(error, key);
            finished = Promise.reject(error);
          }
        }
        finished.then(
          () => forget(key, entry),
          () => forget(key, entry),
        );
        return finished;
      },
      fail: stopPayload,
      end(reason) {
        for (const key of Array.from(entries.keys())) {
          stopPayload(key, reason);
        }
        shared?.abort(reason);
      },
    },
    { maxKeys },
  );
}

/**
 * Sends one value in seroval's binary format, and finishes when it is done.
 * Read it with `fromBinaryStream`.
 */
export function toBinaryStream(value: unknown, options: BinaryWriterOptions): Writer {
  const writer = createBinaryWriter(options);
  writer.push(value);
  writer.flush();
  return writer;
}

/** Reads the value of `toBinaryStream`. */
export function fromBinaryStream<T>(options: BinaryReaderOptions = {}): ValueReader<T> {
  return createValueReader(createBinaryReader(options));
}
