import { ASYNC_ITERATOR_CONSTRUCTOR, PROMISE_CONSTRUCTOR } from './constructors';
import { type LiveStream, isLiveStream } from './live-stream';
import { SYM_ASYNC_ITERATOR } from './symbols';

export interface StreamListener<T> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

/**
 * An internal class rather than a tagged POJO: identity is checked with
 * `instanceof`, which untrusted input cannot forge. The class is exported
 * because bundlers cannot drop an unexported top-level class.
 *
 * The behavior is intentionally duplicated from `STREAM_CONSTRUCTOR`. That
 * constructor's source is embedded verbatim into the eval-based `deserialize`
 * output, which has no access to this class, so the two cannot be shared. A
 * stream read back through `deserialize` is therefore a plain POJO and, by
 * design, is not treated as a genuine Stream on re-serialization. Keep the two
 * implementations in sync.
 */
export class Stream<T> {
  private buffer: unknown[] = [];
  private listeners: (StreamListener<T> | undefined)[] = [];
  private alive = true;
  private success = false;
  private count = 0;
  // 1 marks a live receiver: it drops its buffer after the first listener.
  // 2 marks one that has been consumed.
  private live: number | undefined;

  constructor(live?: number) {
    this.live = live;
  }

  private flush(value: unknown, mode: 'next' | 'throw' | 'return'): void {
    this.live! > 1 || this.buffer.push(value);
    for (let x = 0; x < this.count; x++) {
      this.listeners[x]?.[mode](value as T);
    }
  }

  private replay(listener: StreamListener<T>): void {
    for (let x = 0, z = this.buffer.length; x < z; x++) {
      const current = this.buffer[x];
      if (!this.alive && x === z - 1) {
        listener[this.success ? 'return' : 'throw'](current as T);
      } else {
        listener.next(current as T);
      }
    }
  }

  on(listener: StreamListener<T>): () => void {
    if (this.live! > 1) {
      throw new Error('Stream consumed');
    }
    let subscribed = this.alive;
    let temp = 0;
    if (subscribed) {
      for (; temp < this.count; temp++) {
        if (!this.listeners[temp]) {
          break;
        }
      }
      if (temp === this.count) {
        this.count++;
      }
      this.listeners[temp] = listener;
    }
    this.replay(listener);
    if (this.live) {
      this.live = 2;
      this.buffer.length = 0;
    }
    return () => {
      if (this.alive && subscribed) {
        subscribed = false;
        this.listeners[temp] = undefined;
        while (this.count > 0 && !this.listeners[this.count - 1]) {
          this.count--;
        }
        this.listeners.length = this.count;
      }
    };
  }

  next(value: T): void {
    if (this.alive) {
      this.flush(value, 'next');
    }
  }

  throw(value: unknown): void {
    if (this.alive) {
      this.flush(value, 'throw');
      this.alive = false;
      this.success = false;
      this.listeners.length = 0;
    }
  }

  return(value: T): void {
    if (this.alive) {
      this.flush(value, 'return');
      this.alive = false;
      this.success = true;
      this.listeners.length = 0;
    }
  }
}

export function isStream<T>(value: unknown): value is Stream<T> | LiveStream<T> {
  return value instanceof Stream || isLiveStream(value);
}

export function createStream<T>(): Stream<T> {
  return new Stream<T>();
}

const createAsyncIterable = /* @__PURE__ */ ASYNC_ITERATOR_CONSTRUCTOR(
  SYM_ASYNC_ITERATOR,
  PROMISE_CONSTRUCTOR,
);

export function streamToAsyncIterable<T>(
  stream: Stream<T> | LiveStream<T>,
): () => AsyncIterableIterator<T> {
  return createAsyncIterable(stream) as unknown as () => AsyncIterableIterator<T>;
}
