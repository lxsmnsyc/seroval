import type { CrossSerializeStreamOptions, ToCrossJSONStreamOptions } from 'seroval/write';
import { crossSerializeStream, getCrossReferenceHeader, toCrossJSONStream } from 'seroval/write';
import { encodeFrame } from './frame';
import type { Message } from './message';
import { DATA, DONE, FAIL, SerovalTransportError } from './message';

export type { Message } from './message';
export { SerovalTransportError } from './message';

/** Where a writer sends its messages. */
export interface MessageSink<T = unknown> {
  /**
   * Sends one message. Returning a promise holds back the next message of the
   * same value until it settles, so a slow connection slows down the source.
   */
  send(message: Message<T>): void | PromiseLike<void>;
  /** Runs once, after `flush` when every value is done, or after `close`. */
  onDone?: () => void;
}

export interface WriterOptions<T = unknown> extends MessageSink<T> {
  /**
   * Receives an error that stopped a value, such as a value seroval cannot
   * serialize. The reader only learns that the value failed.
   */
  onError?: (error: unknown, key: string) => void;
}

export interface JSONWriterOptions
  extends Omit<ToCrossJSONStreamOptions, 'onParse' | 'onDone' | 'onError' | 'refs'>, WriterOptions {
  /**
   * Shares one set of references across every value, so a later value can
   * refer to an earlier one. The references are then kept until the writer
   * is done. By default, each value has its own and frees them when it is
   * done. The reader must use the same setting.
   */
  sharedRefs?: boolean;
}

export interface JSWriterOptions
  extends
    Omit<CrossSerializeStreamOptions, 'onSerialize' | 'onDone' | 'onError' | 'refs' | 'scopeId'>,
    WriterOptions {
  /**
   * The key of `$R` that holds the references of this writer. The reader
   * must use the same one. Every value shares these references.
   */
  scopeId: string;
}

export interface Writer {
  /** Starts sending `value` under `key`. Each key can be written once. */
  write(key: string, value: unknown): void;
  /** Starts sending `value` under the next unused number, and returns it. */
  push(value: unknown): string;
  /** Stops one value, stops its sources and tells the reader it failed. */
  cancel(key: string, reason?: unknown): void;
  /** Takes no more values, and finishes once every value is done. */
  flush(): void;
  /** Stops every value now, tells the reader they failed, and finishes. */
  close(reason?: unknown): void;
}

interface ValueCallbacks<T> {
  onData(data: T, initial: boolean): void | PromiseLike<void>;
  onDone(): void;
  onError(error: unknown): void;
}

/** Starts serializing one value, and returns what stops it. */
type StartValue<T> = (value: unknown, callbacks: ValueCallbacks<T>) => (reason?: unknown) => void;

function createWriter<T>(options: WriterOptions<T>, start: StartValue<T>): Writer {
  // The stop function of each value that is still sending.
  const active = new Map<string, (reason?: unknown) => void>();
  // Every key ever written, so a key cannot start a second value.
  const keys = new Set<string>();
  let alive = true;
  let flushed = false;
  let ids = 0;

  function send(message: Message<T>): void | PromiseLike<void> {
    if (alive) {
      return options.send(message);
    }
    return undefined;
  }

  function finish(): void {
    if (alive) {
      alive = false;
      options.onDone?.();
    }
  }

  function settle(key: string): void {
    if (active.delete(key) && flushed && active.size === 0) {
      finish();
    }
  }

  function write(key: string, value: unknown): void {
    if (!alive || flushed) {
      return;
    }
    if (keys.has(key)) {
      throw new SerovalTransportError(`The key "${key}" was already written.`);
    }
    keys.add(key);
    // The value can finish while it starts, before `stop` exists.
    active.set(key, () => {});
    const stop = start(value, {
      onData: (data) => (active.has(key) ? send([DATA, key, data]) : undefined),
      onDone() {
        if (active.has(key)) {
          send([DONE, key]);
          settle(key);
        }
      },
      onError(error) {
        if (active.has(key)) {
          send([FAIL, key]);
          settle(key);
          options.onError?.(error, key);
        }
      },
    });
    if (active.has(key)) {
      active.set(key, stop);
    }
  }

  return {
    write,
    push(value) {
      while (keys.has(String(ids))) {
        ids++;
      }
      const key = String(ids);
      write(key, value);
      return key;
    },
    cancel(key, reason) {
      const stop = active.get(key);
      if (stop) {
        send([FAIL, key]);
        settle(key);
        stop(reason);
      }
    },
    flush() {
      if (alive) {
        flushed = true;
        if (active.size === 0) {
          finish();
        }
      }
    },
    close(reason) {
      if (!alive) {
        return;
      }
      // Tell the reader first, since `finish` stops sending.
      const stops = [...active.values()];
      for (const key of active.keys()) {
        send([FAIL, key]);
      }
      active.clear();
      let failure: { value: unknown } | undefined;
      for (const stop of stops) {
        try {
          stop(reason);
        } catch (error) {
          failure ??= { value: error };
        }
      }
      finish();
      if (failure) {
        throw failure.value;
      }
    },
  };
}

/**
 * Creates a writer that sends each value as cross-reference JSON nodes. Read
 * the messages with `createJSONReader`.
 */
export function createJSONWriter(options: JSONWriterOptions): Writer {
  const shared = options.sharedRefs ? new Map<unknown, number>() : undefined;
  return createWriter(options, (value, callbacks) =>
    // seroval ignores the writer's own options, such as `send`.
    toCrossJSONStream(value, {
      ...options,
      refs: shared ?? new Map(),
      onParse: callbacks.onData,
      onDone: callbacks.onDone,
      onError: callbacks.onError,
    }),
  );
}

/**
 * Creates a writer that sends each value as code. The first message declares
 * `$R[scopeId]`. Read the messages with `createJSReader`, which runs them with
 * `eval`, so only use it when the reader trusts the writer.
 */
export function createJSWriter(options: JSWriterOptions): Writer {
  const header = getCrossReferenceHeader(options.scopeId);
  const refs = new Map<unknown, number>();
  let declared = false;
  return createWriter<string>(options, (value, callbacks) =>
    crossSerializeStream(value, {
      ...options,
      refs,
      onSerialize(data, initial) {
        // The first piece of a value is an expression that evaluates to it.
        if (initial && !declared) {
          declared = true;
          return callbacks.onData(`(${header},${data})`, initial);
        }
        return callbacks.onData(data, initial);
      },
      onDone: callbacks.onDone,
      onError: callbacks.onError,
    }),
  );
}

/**
 * Sends one value as cross-reference JSON nodes, and finishes when it is done.
 * Read it with `fromJSONStream`.
 */
export function toJSONStream(value: unknown, options: JSONWriterOptions): Writer {
  const writer = createJSONWriter(options);
  writer.push(value);
  writer.flush();
  return writer;
}

/**
 * Sends one value as code, and finishes when it is done. Read it with
 * `fromJSStream`.
 */
export function toJSStream(value: unknown, options: JSWriterOptions): Writer {
  const writer = createJSWriter(options);
  writer.push(value);
  writer.flush();
  return writer;
}

/** The default `highWaterMark`, in bytes. */
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;

export interface WebStreamOptions {
  /**
   * How many bytes the stream buffers before the writer holds back the next
   * message. Defaults to 64KiB.
   */
  highWaterMark?: number;
}

/**
 * Turns the messages of a writer into a `ReadableStream` of frames, such as
 * a `fetch` or `Response` body. `start` receives the sink to pass to the
 * writer. Cancelling the stream closes the writer, which stops every source
 * that is still running. Read it with `fromWebStream`.
 */
export function toWebStream(
  start: (sink: Required<MessageSink>) => Pick<Writer, 'close'>,
  options: WebStreamOptions = {},
): ReadableStream<Uint8Array> {
  let writer: Pick<Writer, 'close'> | undefined;
  // Each value that waits for room holds back on its own promise.
  let waiting: (() => void)[] = [];
  let closed = false;
  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        writer = start({
          send(message) {
            if (closed) {
              return undefined;
            }
            const [header, encoded] = encodeFrame(JSON.stringify(message));
            controller.enqueue(header);
            controller.enqueue(encoded);
            // When the queue is full, wait for the next pull.
            if ((controller.desiredSize ?? 1) <= 0) {
              return new Promise<void>((resolve) => {
                waiting.push(resolve);
              });
            }
            return undefined;
          },
          onDone() {
            if (!closed) {
              closed = true;
              controller.close();
            }
          },
        });
      },
      pull() {
        const current = waiting;
        waiting = [];
        for (const resolve of current) {
          resolve();
        }
      },
      cancel(reason) {
        closed = true;
        waiting = [];
        writer?.close(reason);
      },
    },
    new ByteLengthQueuingStrategy({
      highWaterMark: options.highWaterMark ?? DEFAULT_HIGH_WATER_MARK,
    }),
  );
}
