import type { Port } from '../../src/index';

type Listener = (message: unknown) => void;

/** Two ports wired to each other. Messages are copied and delivered later. */
export function createPair(): [Port, Port] {
  const listeners: [Set<Listener>, Set<Listener>] = [new Set(), new Set()];
  const backlog: [unknown[], unknown[]] = [[], []];
  function makePort(self: 0 | 1): Port {
    const other = self === 0 ? 1 : 0;
    return {
      send(message) {
        const copy = structuredClone(message);
        queueMicrotask(() => {
          // Like a MessagePort, hold messages until someone listens.
          if (listeners[other].size === 0) {
            backlog[other].push(copy);
          }
          for (const listener of Array.from(listeners[other])) {
            listener(copy);
          }
        });
      },
      onMessage(listener) {
        listeners[self].add(listener);
        for (const message of backlog[self].splice(0)) {
          listener(message);
        }
        return () => {
          listeners[self].delete(listener);
        };
      },
    };
  }
  return [makePort(0), makePort(1)];
}

/** Lets the event loop run until nothing else is queued. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn++) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}
