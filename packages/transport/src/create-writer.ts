import type { Message } from './message';
import { DATA, DONE, FAIL, SerovalTransportError } from './message';

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
  /** Closes the writer with the abort reason when it aborts. */
  signal?: AbortSignal;
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

export interface ValueCallbacks<T> {
  onData(data: T, initial: boolean): void | PromiseLike<void>;
  onDone(): void;
  onError(error: unknown): void;
}

/** Starts serializing one value, and returns what stops it. */
export type StartValue<T> = (
  value: unknown,
  callbacks: ValueCallbacks<T>,
) => (reason?: unknown) => void;

export function createWriter<T>(options: WriterOptions<T>, start: StartValue<T>): Writer {
  // The stop function of each value that is still sending.
  const active = new Map<string, (reason?: unknown) => void>();
  // Every key that `write` used, so a key cannot start a second value. Keys
  // from `push` are below `ids`, so they need no entry, and a long-lived
  // writer that only pushes keeps no state for values that are done.
  const written = new Set<string>();
  const signal = options.signal;
  let alive = true;
  let flushed = false;
  let ids = 0;

  function isUsed(key: string): boolean {
    if (written.has(key)) {
      return true;
    }
    // Only the canonical form of a number below `ids` came from `push`.
    const id = Number(key);
    return Number.isSafeInteger(id) && id >= 0 && id < ids && String(id) === key;
  }

  function send(message: Message<T>): void | PromiseLike<void> {
    if (alive) {
      return options.send(message);
    }
    return undefined;
  }

  function finish(): void {
    if (alive) {
      alive = false;
      signal?.removeEventListener('abort', onAbort);
      options.onDone?.();
    }
  }

  function onAbort(): void {
    // An error thrown in an event listener reaches no caller, so a source
    // that throws while it stops is ignored here.
    try {
      close(signal?.reason);
    } catch {}
  }

  function settle(key: string): void {
    if (active.delete(key) && flushed && active.size === 0) {
      finish();
    }
  }

  function begin(key: string, value: unknown): void {
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

  function close(reason?: unknown): void {
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
  }

  // A signal that already aborted closes the writer before any value starts.
  if (signal?.aborted) {
    finish();
  } else {
    signal?.addEventListener('abort', onAbort);
  }

  return {
    write(key, value) {
      if (!alive || flushed) {
        return;
      }
      if (isUsed(key)) {
        throw new SerovalTransportError(`The key "${key}" was already written.`);
      }
      written.add(key);
      begin(key, value);
    },
    push(value) {
      while (written.has(String(ids))) {
        written.delete(String(ids));
        ids++;
      }
      const key = String(ids);
      ids++;
      if (alive && !flushed) {
        begin(key, value);
      }
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
    close,
  };
}
