import type { RpcSignal } from './types';

/** A signal and the function that aborts it. */
export interface RpcSignalController {
  readonly signal: RpcSignal;
  /** Aborts the signal with `reason`. Only the first call has an effect. */
  abort(reason?: unknown): void;
}

/** Makes a signal for `with({ signal })`, with no Web API. */
export function createRpcSignal(): RpcSignalController {
  const listeners = new Set<(reason: unknown) => void>();
  let aborted = false;
  let reason: unknown;

  const signal: RpcSignal = {
    get aborted() {
      return aborted;
    },
    get reason() {
      return reason;
    },
    onAbort(listener) {
      // A signal that already aborted never calls a new listener.
      if (aborted) {
        return removeNothing;
      }
      // Wrap the listener so the same function can be added twice.
      function call(value: unknown): void {
        listener(value);
      }
      listeners.add(call);
      return () => {
        listeners.delete(call);
      };
    },
  };

  function abort(value?: unknown): void {
    if (aborted) {
      return;
    }
    aborted = true;
    reason = value;
    // Take the listeners first, so one that adds another does not loop.
    const pending = [...listeners];
    listeners.clear();
    // Every listener runs even when one throws; the first error is rethrown.
    let failed = false;
    let error: unknown;
    for (const listener of pending) {
      try {
        listener(value);
      } catch (thrown) {
        if (!failed) {
          failed = true;
          error = thrown;
        }
      }
    }
    if (failed) {
      throw error;
    }
  }

  return { signal, abort };
}

function removeNothing(): void {}
