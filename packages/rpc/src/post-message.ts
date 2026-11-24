import type { Port } from './endpoint';

/**
 * The part of a `Worker`, `MessagePort` or `DedicatedWorkerGlobalScope` that
 * the adapter uses.
 */
export interface MessagePortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  // oxlint-disable-next-line no-explicit-any -- event types differ by port.
  addEventListener(type: string, listener: (event: any) => void): void;
  // oxlint-disable-next-line no-explicit-any -- event types differ by port.
  removeEventListener(type: string, listener: (event: any) => void): void;
  /** A `MessagePort` needs it to deliver messages to `addEventListener`. */
  start?(): void;
  /** A `MessagePort` has it; a `Worker` does not, and must not be terminated. */
  close?(): void;
}

/** Adapts a `Worker`, a `MessagePort` or the worker's own scope to a rpc port. */
export function fromMessagePort(source: MessagePortLike): Port {
  // oxlint-disable-next-line no-explicit-any -- event types differ by port.
  function listen(type: string, listener: (event: any) => void): () => void {
    source.addEventListener(type, listener);
    return () => {
      source.removeEventListener(type, listener);
    };
  }

  return {
    send(message) {
      source.postMessage(message);
    },
    onMessage(listener) {
      const stop = listen('message', (event: { data: unknown }) => {
        listener(event.data);
      });
      source.start?.();
      return stop;
    },
    onError(listener) {
      // The `error` event of a worker, and a message that cannot be read.
      const stopError = listen('error', listener);
      const stopMessage = listen('messageerror', listener);
      return () => {
        stopError();
        stopMessage();
      };
    },
    onClose(listener) {
      // A MessagePort emits `close` when the peer goes away; a Worker has none.
      return listen('close', () => {
        listener();
      });
    },
    close() {
      source.close?.();
    },
  };
}
