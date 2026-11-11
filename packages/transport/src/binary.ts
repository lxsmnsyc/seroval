import type { DeserializeOptions, SerializeOptions } from 'seroval/binary';
import { deserialize, serialize } from 'seroval/binary';
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
    WriterOptions<Uint8Array> {}

export interface BinaryReaderOptions
  extends
    Omit<DeserializeOptions, 'read' | 'onError' | 'onDone' | 'refs' | 'signal'>,
    ReaderOptions {
  /**
   * Receives an error that stopped a value, such as bytes that do not decode.
   * The value, and what still waits in it, fail with the error.
   */
  onError?: (error: unknown, key: string) => void;
}

/**
 * Creates a writer that sends each value in seroval's binary format, as
 * bytes. Each value has its own references. Read the messages with
 * `createBinaryReader`. The frames of `encodeFrame` carry the bytes as they
 * are, without JSON.
 */
export function createBinaryWriter(options: BinaryWriterOptions): Writer {
  return createWriter<Uint8Array>(options, (value, callbacks) => {
    let initial = true;
    // seroval ignores the writer's own options, such as `send`.
    return serialize(value, {
      ...options,
      refs: new Map(),
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

/** The bytes of one value, which its deserializer pulls one chunk at a time. */
interface Session {
  chunks: Uint8Array[];
  // The read that waits for the next chunk, or for the end.
  waiting: ((chunk: Uint8Array | undefined) => void) | undefined;
  ended: boolean;
  // Settles once the deserializer read every byte, or the value fails.
  decoded: Promise<void>;
  // Fails the value and stops its deserializer.
  stop(reason: unknown): void;
}

function readSession(session: Session): Promise<Uint8Array | undefined> {
  const chunk = session.chunks.shift();
  if (chunk || session.ended) {
    return Promise.resolve(chunk);
  }
  return new Promise((resolve) => {
    session.waiting = resolve;
  });
}

/** Passes `chunk` to the deserializer, or the end when it is `undefined`. */
function pushSession(session: Session, chunk: Uint8Array | undefined): void {
  if (chunk === undefined) {
    session.ended = true;
  }
  const waiting = session.waiting;
  if (waiting) {
    session.waiting = undefined;
    waiting(chunk);
  } else if (chunk) {
    session.chunks.push(chunk);
  }
}

function assertBytes(data: unknown): asserts data is Uint8Array {
  if (!(data instanceof Uint8Array)) {
    throw new SerovalTransportError('The transport received a malformed message.');
  }
}

/**
 * Creates a reader of the messages of `createBinaryWriter`. It never runs
 * code from the messages.
 */
export function createBinaryReader(options: BinaryReaderOptions = {}): Reader {
  const { maxKeys, onError, ...deserializer } = options;
  // The session of each key until it is decoded, fails or is stopped. One
  // that failed stays, so `done` can still reject with its error.
  const sessions = new Map<string, Session>();

  function forget(key: string, session: Session): void {
    if (sessions.get(key) === session) {
      sessions.delete(key);
    }
  }

  /** Starts decoding `key`, and returns its value. */
  function openSession(key: string, data: Uint8Array): Promise<unknown> {
    const controller = new AbortController();
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const session: Session = {
      chunks: [data],
      waiting: undefined,
      ended: false,
      decoded: new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
      stop(reason) {
        // Reject before the abort, which ends the deserializer as if it read
        // every byte.
        reject(reason);
        session.chunks = [];
        pushSession(session, undefined);
        controller.abort(reason);
      },
    };
    // Nothing waits on it when the writer fails the value.
    session.decoded.catch(() => {});
    sessions.set(key, session);

    return deserialize({
      ...deserializer,
      signal: controller.signal,
      read: () => readSession(session),
      onDone() {
        forget(key, session);
        resolve();
      },
      onError(error) {
        // A peer that sends bytes that do not decode cannot be trusted with
        // the rest of the value.
        if (!controller.signal.aborted) {
          session.stop(error);
          onError?.(error, key);
        }
      },
    }).then((result) => result.value);
  }

  function stopSession(key: string, reason: unknown): void {
    const session = sessions.get(key);
    if (session) {
      sessions.delete(key);
      session.stop(reason);
    }
  }

  return createReader(
    {
      open(key, data) {
        assertBytes(data);
        return openSession(key, data);
      },
      next(key, data) {
        assertBytes(data);
        const session = sessions.get(key);
        if (session && !session.ended) {
          pushSession(session, data);
        }
      },
      done(key) {
        const session = sessions.get(key);
        if (!session) {
          return undefined;
        }
        pushSession(session, undefined);
        // A session that failed is forgotten here, since `onDone` never runs.
        session.decoded.catch(() => forget(key, session));
        return session.decoded;
      },
      fail: stopSession,
      end(reason) {
        for (const key of Array.from(sessions.keys())) {
          stopSession(key, reason);
        }
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
