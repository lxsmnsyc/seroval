import { ASYNC_ITERATOR_CONSTRUCTOR, PROMISE_CONSTRUCTOR } from './constructors';
import { SYM_ASYNC_ITERATOR } from './symbols';

export interface StreamListener<T> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

/**
 * An internal class rather than a tagged POJO: identity is checked with
 * `instanceof`, which untrusted input cannot forge (the class is not exported).
 *
 * The behavior is intentionally duplicated from `STREAM_CONSTRUCTOR`. That
 * constructor's source is embedded verbatim into the eval-based `deserialize`
 * output, which has no access to this class, so the two cannot be shared. A
 * stream read back through `deserialize` is therefore a plain POJO and, by
 * design, is not treated as a genuine Stream on re-serialization. Keep the two
 * implementations in sync.
 */
export class Stream<T> {
  #buffer: unknown[] = [];
  #listeners: (StreamListener<T> | undefined)[] = [];
  #alive = true;
  #success = false;
  #count = 0;

  #flush(value: unknown, mode: 'next' | 'throw' | 'return'): void {
    for (let x = 0; x < this.#count; x++) {
      this.#listeners[x]?.[mode](value as T);
    }
  }

  #replay(listener: StreamListener<T>): void {
    for (let x = 0, z = this.#buffer.length; x < z; x++) {
      const current = this.#buffer[x];
      if (!this.#alive && x === z - 1) {
        listener[this.#success ? 'return' : 'throw'](current as T);
      } else {
        listener.next(current as T);
      }
    }
  }

  on(listener: StreamListener<T>): () => void {
    let subscribed = this.#alive;
    let temp = 0;
    if (subscribed) {
      for (; temp < this.#count; temp++) {
        if (!this.#listeners[temp]) {
          break;
        }
      }
      if (temp === this.#count) {
        this.#count++;
      }
      this.#listeners[temp] = listener;
    }
    this.#replay(listener);
    return () => {
      if (this.#alive && subscribed) {
        subscribed = false;
        this.#listeners[temp] = undefined;
        while (this.#count > 0 && !this.#listeners[this.#count - 1]) {
          this.#count--;
        }
        this.#listeners.length = this.#count;
      }
    };
  }

  next(value: T): void {
    if (this.#alive) {
      this.#buffer.push(value);
      this.#flush(value, 'next');
    }
  }

  throw(value: unknown): void {
    if (this.#alive) {
      this.#buffer.push(value);
      this.#flush(value, 'throw');
      this.#alive = false;
      this.#success = false;
      this.#listeners.length = 0;
    }
  }

  return(value: T): void {
    if (this.#alive) {
      this.#buffer.push(value);
      this.#flush(value, 'return');
      this.#alive = false;
      this.#success = true;
      this.#listeners.length = 0;
    }
  }
}

export function isStream<T>(value: unknown): value is Stream<T> {
  return value instanceof Stream;
}

export function createStream<T>(): Stream<T> {
  return new Stream<T>();
}

export function createStreamFromAsyncIterable<T>(
  iterable: AsyncIterable<T>,
  cleanups?: (() => void)[],
): Stream<T> {
  const stream = createStream<T>();

  const iterator = iterable[SYM_ASYNC_ITERATOR]();
  let cancelled = false;
  let done = false;

  cleanups?.push(() => {
    if (!(done || cancelled)) {
      cancelled = true;
      Promise.resolve()
        .then(() => iterator.return?.())
        .catch(() => {
          // no-op
        });
    }
  });

  async function push(): Promise<void> {
    try {
      while (!cancelled) {
        const value = await iterator.next();
        if (cancelled) {
          return;
        }
        if (value.done) {
          done = true;
          stream.return(value.value as T);
          break;
        }
        stream.next(value.value);
      }
    } catch (error) {
      done = true;
      if (!cancelled) {
        stream.throw(error);
      }
    }
  }

  push().catch(() => {
    // no-op
  });

  return stream;
}

const createAsyncIterable = ASYNC_ITERATOR_CONSTRUCTOR(
  SYM_ASYNC_ITERATOR,
  PROMISE_CONSTRUCTOR,
);

export function streamToAsyncIterable<T>(
  stream: Stream<T>,
): () => AsyncIterableIterator<T> {
  return createAsyncIterable(
    stream,
  ) as unknown as () => AsyncIterableIterator<T>;
}
