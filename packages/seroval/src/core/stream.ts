import type { Deferred } from './utils/deferred';
import { createDeferred } from './utils/deferred';

interface StreamListener<T> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export interface Stream<T> {
  __SEROVAL_STREAM__: true;

  on(listener: StreamListener<T>): () => void;

  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export function isStream<T>(value: object): value is Stream<T> {
  return '__SEROVAL_STREAM__' in value;
}

export function createStream<T>(): Stream<T> {
  const listeners = new Set<StreamListener<T>>();
  const buffer: unknown[] = [];
  let alive = true;
  let success = true;

  function flushNext(value: T): void {
    for (const listener of listeners.keys()) {
      listener.next(value);
    }
  }

  function flushThrow(value: unknown): void {
    for (const listener of listeners.keys()) {
      listener.throw(value);
    }
  }

  function flushReturn(value: T): void {
    for (const listener of listeners.keys()) {
      listener.return(value);
    }
  }

  return {
    __SEROVAL_STREAM__: true,
    on(listener: StreamListener<T>): () => void {
      if (alive) {
        listeners.add(listener);
      }
      for (let i = 0, len = buffer.length; i < len; i++) {
        const value = buffer[i];
        if (i === len - 1 && !alive) {
          if (success) {
            listener.return(value as T);
          } else {
            listener.throw(value);
          }
        } else {
          listener.next(value as T);
        }
      }
      return () => {
        if (alive) {
          listeners.delete(listener);
        }
      };
    },
    next(value): void {
      if (alive) {
        buffer.push(value);
        flushNext(value);
      }
    },
    throw(value): void {
      if (alive) {
        buffer.push(value);
        flushThrow(value);
        alive = false;
        success = false;
        listeners.clear();
      }
    },
    return(value): void {
      if (alive) {
        buffer.push(value);
        flushReturn(value);
        alive = false;
        success = true;
        listeners.clear();
      }
    },
  };
}

export function createStreamFromAsyncIterable<T>(
  iterable: AsyncIterable<T>,
): Stream<T> {
  const stream = createStream<T>();

  const iterator = iterable[Symbol.asyncIterator]();

  async function push(): Promise<void> {
    try {
      const value = await iterator.next();
      if (value.done) {
        stream.return(value.value as T);
      } else {
        stream.next(value.value);
        await push();
      }
    } catch (error) {
      stream.throw(error);
    }
  }

  push().catch(() => {
    // no-op
  });

  return stream;
}

export function streamToAsyncIterable<T>(
  stream: Stream<T>,
): () => AsyncIterableIterator<T> {
  return (): AsyncIterableIterator<T> => {
    const buffer: T[] = [];
    const pending: Deferred[] = [];
    let count = 0;
    let doneAt = -1;
    let isThrow = false;

    function resolveAll(): void {
      for (let i = 0, len = pending.length; i < len; i++) {
        pending[i].resolve({ done: true, value: undefined });
      }
    }

    stream.on({
      next(value) {
        const current = pending.shift();
        if (current) {
          current.resolve({ done: false, value });
        }
        buffer.push(value);
      },
      throw(value) {
        const current = pending.shift();
        if (current) {
          current.reject(value);
        }
        resolveAll();
        doneAt = buffer.length;
        buffer.push(value as T);
        isThrow = true;
      },
      return(value) {
        const current = pending.shift();
        if (current) {
          current.resolve({ done: true, value });
        }
        resolveAll();
        doneAt = buffer.length;
        buffer.push(value);
      },
    });

    function finalize() {
      const current = count++;
      const value = buffer[current];
      if (current !== doneAt) {
        return { done: false, value };
      }
      if (isThrow) {
        throw value;
      }
      return { done: true, value };
    }

    return {
      [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return this;
      },
      async next(): Promise<IteratorResult<T>> {
        if (doneAt === -1) {
          const current = count++;
          if (current >= buffer.length) {
            const deferred = createDeferred();
            pending.push(deferred);
            return (await deferred.promise) as Promise<IteratorResult<T>>;
          }
          return { done: false, value: buffer[current] };
        }
        if (count > doneAt) {
          return { done: true, value: undefined };
        }
        return finalize();
      },
    };
  };
}
