import type { MessagePort, Worker } from 'node:worker_threads';
import type { Port } from './endpoint';

/**
 * Adapts a `worker_threads` `Worker`, or the `parentPort` of a worker, to a
 * rpc port. They emit the bare message with `on`.
 */
// oxlint-disable-next-line import/prefer-default-export -- the entry point exports it by name.
export function fromNodeWorker(source: Worker | MessagePort): Port {
  // oxlint-disable-next-line no-explicit-any -- event payloads differ by event.
  function listen(type: string, listener: (value: any) => void): () => void {
    source.on(type, listener);
    return () => {
      source.off(type, listener);
    };
  }

  return {
    send(message) {
      source.postMessage(message, []);
    },
    onMessage(listener) {
      return listen('message', listener);
    },
    onError(listener) {
      const stopError = listen('error', listener);
      const stopMessage = listen('messageerror', listener);
      return () => {
        stopError();
        stopMessage();
      };
    },
    onClose(listener) {
      // A Worker ends with `exit`, and a MessagePort with `close`.
      const stopExit = listen('exit', () => {
        listener();
      });
      const stopClose = listen('close', () => {
        listener();
      });
      return () => {
        stopExit();
        stopClose();
      };
    },
    close() {
      // Terminating a Worker would drop messages still on the way to it. The
      // worker closes its own port when it closes, and then exits by itself.
      if ('close' in source) {
        source.close();
      }
    },
  };
}
