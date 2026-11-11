import type { MessagePort, Worker } from 'node:worker_threads';
import type { MessagePortLike } from '../../src/types';

/**
 * Adapts a `worker_threads` Worker or MessagePort (the worker's `parentPort`)
 * to `MessagePortLike`. Both emit the bare message with `on`, where
 * `MessagePortLike` expects an event with `data`.
 */
export default function toPort(source: Worker | MessagePort): MessagePortLike {
  return {
    postMessage(message, transfer) {
      // The DOM and Node declare different `Transferable` types for the same
      // objects, so the list needs a cast.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      source.postMessage(message, transfer as never);
    },
    addEventListener(type: string, listener: (event: { data: unknown }) => void) {
      if (type === 'message') {
        // Wrap the bare message into an event.
        source.on('message', (data: unknown) => {
          listener({ data });
        });
      } else {
        source.on(type, listener);
      }
    },
    close() {
      // Terminating a Worker would drop messages still on the way to it. The
      // worker closes its own port when it receives the close message, and
      // then exits by itself.
      if ('close' in source) {
        source.close();
      }
    },
  };
}
