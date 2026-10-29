import type { CrossDeserializer, CrossDeserializerOptions, SerovalNode } from 'seroval/read';
import { createCrossDeserializer, deserialize, isStream } from 'seroval/read';
import { FrameReader } from './frame';
import { DATA, DONE, SerovalTransportError, assertMessage } from './message';

export type { Message } from './message';
export { SerovalTransportError } from './message';

export interface Reader {
  /**
   * Takes the next message from the writer. Throws on a malformed message;
   * end the reader with that error then, since the writer cannot be trusted
   * anymore.
   */
  push(message: unknown): void;
  /**
   * Resolves with the value of `key` once its first message arrives. Later
   * messages settle the promises and streams in it.
   */
  get<T>(key: string): Promise<T>;
  /**
   * Stops reading `key`: fails what still waits in it, forgets it, and drops
   * its later messages. Tell the writer to `cancel` it too, if it can hear.
   */
  cancel(key: string, reason?: unknown): void;
  /**
   * Stops reading. Every value that has not arrived, and every promise and
   * stream that still waits, fails with `reason`, or with a
   * `SerovalTransportError` when there is none.
   */
  end(reason?: unknown): void;
}

/** A reader of a single value, from `fromJSONStream` or `fromJSStream`. */
export interface ValueReader<T> extends Pick<Reader, 'push' | 'end'> {
  value: Promise<T>;
}

export interface JSONReaderOptions extends CrossDeserializerOptions {
  /** Shares one set of references across every value. Match the writer. */
  sharedRefs?: boolean;
}

export interface JSReaderOptions {
  /** The `scopeId` that the writer used. */
  scopeId: string;
}

/** How a reader turns the data of each key into values. */
interface Decoder {
  /** Decodes the first data of `key`, and returns its value. */
  open(key: string, data: unknown): unknown;
  /** Decodes later data of `key`. */
  next(key: string, data: unknown): void;
  /** Frees `key` after it settled. */
  done(key: string): void;
  /** Fails what still waits in `key`, and frees it. */
  fail(key: string, reason: unknown): void;
  /** Fails what still waits in every key. */
  end(reason: unknown): void;
}

const WAITING = 0;
const OPEN = 1;
const SETTLED = 2;

interface Slot {
  state: typeof WAITING | typeof OPEN | typeof SETTLED;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
}

// A value that nobody reads can fail, and must not cause an unhandled
// rejection. Code that awaits it still gets the rejection.
const ignoreRejection = (): void => {};

function createSlot(): Slot {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(ignoreRejection);
  return { state: WAITING, promise, resolve, reject };
}

function createEndError(): SerovalTransportError {
  return new SerovalTransportError('The stream ended before every value settled.');
}

function createMissingError(key: string): SerovalTransportError {
  return new SerovalTransportError(`The stream ended before "${key}" arrived.`);
}

function createFailError(key: string): SerovalTransportError {
  return new SerovalTransportError(`The writer failed or cancelled "${key}".`);
}

function createUnexpectedError(key: string): SerovalTransportError {
  return new SerovalTransportError(`The transport received a message for "${key}" after it ended.`);
}

function createReader(decoder: Decoder): Reader {
  const slots = new Map<string, Slot>();
  // Keys that the reader cancelled before the writer ended them. Their later
  // messages are dropped.
  const cancelled = new Set<string>();
  let ended = false;
  let endReason: unknown;

  function getSlot(key: string): Slot {
    let slot = slots.get(key);
    if (!slot) {
      slot = createSlot();
      slots.set(key, slot);
    }
    return slot;
  }

  function onData(key: string, data: unknown): void {
    const slot = getSlot(key);
    if (slot.state === WAITING) {
      slot.state = OPEN;
      slot.resolve(decoder.open(key, data));
    } else if (slot.state === OPEN) {
      decoder.next(key, data);
    } else {
      throw createUnexpectedError(key);
    }
  }

  function onEnd(key: string, done: boolean): void {
    const slot = getSlot(key);
    if (slot.state === SETTLED || (done && slot.state === WAITING)) {
      throw createUnexpectedError(key);
    }
    const state = slot.state;
    slot.state = SETTLED;
    if (state === WAITING) {
      slot.reject(createFailError(key));
    } else if (done) {
      decoder.done(key);
    } else {
      decoder.fail(key, createFailError(key));
    }
  }

  return {
    push(message) {
      if (ended) {
        return;
      }
      assertMessage(message);
      const key = message[1];
      if (cancelled.has(key)) {
        if (message[0] !== DATA) {
          cancelled.delete(key);
        }
        return;
      }
      if (message[0] === DATA) {
        onData(key, message[2]);
      } else {
        onEnd(key, message[0] === DONE);
      }
    },
    get<T>(key: string): Promise<T> {
      const slot = slots.get(key);
      if (slot) {
        return slot.promise as Promise<T>;
      }
      const created = getSlot(key);
      if (ended) {
        created.reject(endReason ?? createMissingError(key));
        created.state = SETTLED;
      }
      return created.promise as Promise<T>;
    },
    cancel(key, reason = new SerovalTransportError(`"${key}" was cancelled.`)) {
      const slot = slots.get(key);
      slots.delete(key);
      if (ended || slot?.state === SETTLED) {
        return;
      }
      cancelled.add(key);
      if (slot?.state === WAITING) {
        slot.reject(reason);
      } else if (slot?.state === OPEN) {
        decoder.fail(key, reason);
      }
    },
    end(reason) {
      if (ended) {
        return;
      }
      ended = true;
      endReason = reason;
      cancelled.clear();
      for (const [key, slot] of slots) {
        if (slot.state === WAITING) {
          slot.reject(reason ?? createMissingError(key));
        }
        slot.state = SETTLED;
      }
      decoder.end(reason ?? createEndError());
    },
  };
}

/**
 * Creates a reader of the messages of `createJSONWriter`. It never runs code
 * from the messages.
 */
export function createJSONReader(options: JSONReaderOptions = {}): Reader {
  const { sharedRefs, ...deserializer } = options;
  if (sharedRefs) {
    const session = createCrossDeserializer(deserializer);
    return createReader({
      open: (_, data) => session.deserialize(data as SerovalNode),
      next(_, data) {
        session.deserialize(data as SerovalNode);
      },
      // The references are shared, so a key cannot free or fail them alone.
      done() {},
      fail() {},
      end(reason) {
        if (session.pending > 0) {
          session.abort(reason);
        }
      },
    });
  }
  const sessions = new Map<string, CrossDeserializer>();
  function stopSession(key: string, reason: unknown): void {
    const session = sessions.get(key);
    sessions.delete(key);
    if (session && session.pending > 0) {
      session.abort(reason);
    }
  }
  return createReader({
    open(key, data) {
      const session = createCrossDeserializer(deserializer);
      sessions.set(key, session);
      return session.deserialize(data as SerovalNode);
    },
    next(key, data) {
      sessions.get(key)?.deserialize(data as SerovalNode);
    },
    done(key) {
      stopSession(key, createEndError());
    },
    fail: stopSession,
    end(reason) {
      // Abort every session, even when a stream listener throws.
      let failure: { value: unknown } | undefined;
      for (const key of Array.from(sessions.keys())) {
        try {
          stopSession(key, reason);
        } catch (error) {
          failure ??= { value: error };
        }
      }
      if (failure) {
        throw failure.value;
      }
    },
  });
}

/**
 * Fails every value in a `$R` scope that is still waiting on a message.
 * These are the open streams and the pending promise resolvers (`{ p, s, f }`)
 * from seroval's constructors. Failing a settled promise or a closed stream
 * does nothing. A ref can be any value a plugin decoded, so each read is
 * guarded.
 */
function releaseScope(scopeId: string, reason: unknown): void {
  // The messages declare `$R` on `self`, which is `globalThis` in browsers
  // and workers.
  const scopes = (globalThis as { self?: { $R?: Record<string, unknown[] | undefined> } }).self?.$R;
  const refs = scopes?.[scopeId];
  if (!scopes || !refs) {
    return;
  }
  delete scopes[scopeId];
  let listenerError: unknown;
  for (const value of refs) {
    if (value === null || typeof value !== 'object') {
      continue;
    }
    try {
      const ref = value as Record<string, unknown>;
      if (isStream(ref) || ref.__SEROVAL_STREAM__ === true) {
        (ref as { throw(value: unknown): void }).throw(reason);
      } else if (
        typeof ref.s === 'function' &&
        typeof ref.f === 'function' &&
        ref.p instanceof Promise
      ) {
        ref.p.catch(ignoreRejection);
        ref.f(reason);
      }
    } catch (error) {
      listenerError ??= error;
    }
  }
  if (listenerError !== undefined) {
    throw listenerError;
  }
}

/**
 * Creates a reader of the messages of `createJSWriter`. Each message runs
 * with `eval`, so only read messages from a writer you trust. Every value
 * shares the references of `$R[scopeId]`, so `cancel` and a failed value
 * only fail what waits in them when the reader ends.
 */
export function createJSReader(options: JSReaderOptions): Reader {
  const scopeId = options.scopeId;
  return createReader({
    open: (_, data) => deserialize(data as string),
    next(_, data) {
      deserialize(data as string);
    },
    done() {},
    fail() {},
    end(reason) {
      releaseScope(scopeId, reason);
    },
  });
}

/** The key that `toJSONStream` and `toJSStream` send their value under. */
const VALUE_KEY = '0';

function createValueReader<T>(reader: Reader): ValueReader<T> {
  return { value: reader.get<T>(VALUE_KEY), push: reader.push, end: reader.end };
}

/** Reads the value of `toJSONStream`. */
export function fromJSONStream<T>(options: JSONReaderOptions = {}): ValueReader<T> {
  return createValueReader(createJSONReader(options));
}

/** Reads the value of `toJSStream`. */
export function fromJSStream<T>(options: JSReaderOptions): ValueReader<T> {
  return createValueReader(createJSReader(options));
}

/** The default `maxFrameSize`, in bytes. */
const DEFAULT_MAX_FRAME_SIZE = 64 * 1024 * 1024;

export interface FromWebStreamOptions {
  /** Refuses any frame larger than this many bytes. Defaults to 64MiB. */
  maxFrameSize?: number;
  /** Stops reading, and ends the reader with the abort reason. */
  signal?: AbortSignal;
  /**
   * Receives an error of the stream, such as a malformed frame or a dropped
   * connection. The reader also ends with it.
   */
  onError?: (error: unknown) => void;
}

/**
 * Reads the frames of `toWebStream` from `stream` into `reader`, and ends the
 * reader when the stream ends. Settles when it stops, and never rejects.
 */
export async function fromWebStream(
  stream: ReadableStream<Uint8Array>,
  reader: Pick<Reader, 'push' | 'end'>,
  options: FromWebStreamOptions = {},
): Promise<void> {
  const frames = new FrameReader(stream, options.maxFrameSize ?? DEFAULT_MAX_FRAME_SIZE);
  const signal = options.signal;
  let stopped = false;

  // Ends the reader once. A stream listener that throws while its value
  // fails is reported, since nothing awaits this function's errors.
  function stop(reason: unknown, report: boolean): void {
    if (stopped) {
      return;
    }
    stopped = true;
    signal?.removeEventListener('abort', onAbort);
    try {
      reader.end(reason);
    } catch (error) {
      options.onError?.(error);
    }
    if (report) {
      options.onError?.(reason);
    }
  }

  function onAbort(): void {
    void frames.cancel(signal?.reason);
    stop(signal?.reason, false);
  }

  if (signal?.aborted) {
    onAbort();
    return;
  }
  signal?.addEventListener('abort', onAbort);
  try {
    let data: string | undefined;
    while (!stopped && (data = await frames.next()) !== undefined) {
      // The signal can abort while the frame is read.
      if (!stopped) {
        reader.push(JSON.parse(data));
      }
    }
    stop(undefined, false);
  } catch (error) {
    if (!stopped) {
      await frames.cancel(error);
      stop(error, true);
    }
  }
}
