/* oxlint-disable typescript/promise-function-async -- the gate returns nothing when the source may go on, which an async function cannot. */
/** The `t` of a seroval node that carries one more item of a stream. */
const STREAM_NEXT = 32;

/** The window of a reader when `EndpointOptions.window` is not set. */
export const DEFAULT_WINDOW = 16;

/** Checks `EndpointOptions.window` and fills in the default. */
export function resolveWindow(window: number | undefined): number {
  if (window === undefined) {
    return DEFAULT_WINDOW;
  }
  if (!Number.isSafeInteger(window) || window < 1) {
    throw new RangeError('The window must be a positive integer.');
  }
  return window;
}

/** True when a transport DATA message carries one more item of a stream. */
export function isStreamItem(message: unknown): boolean {
  if (!Array.isArray(message) || message[0] !== 0) {
    return false;
  }
  const data: unknown = message[2];
  return typeof data === 'object' && data !== null && (data as { t?: unknown }).t === STREAM_NEXT;
}

interface KeyState {
  /** Items sent that the reader has not credited back. */
  inflight: number;
  /** Streams of the value that wait for credit before they send more. */
  waiters: (() => void)[];
}

/**
 * The writer side of the credit window. It counts the stream items sent under
 * each key and holds the source back once `window` of them are not credited.
 */
export interface CreditGate {
  /**
   * Counts one item sent under `key`. Returns a promise that settles once the
   * source may send again, or nothing when it may send at once.
   */
  sent(key: string): Promise<void> | undefined;
  /** The reader consumed `count` items of `key`. */
  credit(key: string, count: number): void;
  /** The value under `key` ended or was cancelled. Frees its state. */
  end(key: string): void;
  /** Frees every key and lets every held source go. */
  clear(): void;
  /** Sets the window the peer advertised, and lets held sources go. */
  setWindow(size: number): void;
  /** How many keys hold state. */
  readonly size: number;
}

export function createCreditGate(): CreditGate {
  // Zero until the peer says how many items it allows in flight.
  let window = 0;
  const states = new Map<string, KeyState>();

  function release(state: KeyState): void {
    const waiters = state.waiters;
    state.waiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  return {
    get size() {
      return states.size;
    },
    sent(key) {
      let state = states.get(key);
      if (!state) {
        state = { inflight: 0, waiters: [] };
        states.set(key, state);
      }
      state.inflight++;
      if (window > 0 && state.inflight < window) {
        return undefined;
      }
      const held = state;
      return new Promise<void>((resolve) => {
        held.waiters.push(resolve);
      });
    },
    credit(key, count) {
      const state = states.get(key);
      if (!state) {
        return;
      }
      state.inflight = Math.max(0, state.inflight - count);
      if (window > 0 && state.inflight < window) {
        release(state);
      }
    },
    setWindow(size) {
      window = size;
      for (const state of states.values()) {
        if (state.inflight < window) {
          release(state);
        }
      }
    },
    end(key) {
      const state = states.get(key);
      if (state) {
        states.delete(key);
        release(state);
      }
    },
    clear() {
      const all = [...states.values()];
      states.clear();
      for (const state of all) {
        release(state);
      }
    },
  };
}
