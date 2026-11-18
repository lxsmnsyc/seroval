import { NIL } from './constants';
import { ASYNC_ITERATOR_CONSTRUCTOR, PROMISE_CONSTRUCTOR } from './constructors';
import { type LiveStream, isLiveStream } from './live-stream';
import { SYM_ASYNC_ITERATOR } from './symbols';

/** The callbacks a {@link Stream} consumer registers through {@link Stream.on}. */
export interface StreamListener<T> {
  /** Called for each value pushed onto the stream. */
  next(value: T): void;
  /** Called once when the stream ends with an error. */
  throw(value: unknown): void;
  /** Called once when the stream ends normally, with its final value. */
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

  /**
   * Returns the events of a stream that has ended, without subscribing, so a
   * live receiver is not consumed. The last value is the `return` or `throw`
   * value. Returns `undefined` while the stream is open, or when a live
   * receiver was already consumed and has no events left.
   * @internal
   */
  endedEvents(): { values: unknown[]; success: boolean } | undefined {
    if (this.alive || this.live! > 1) {
      return NIL;
    }
    return { values: this.buffer.slice(), success: this.success };
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

/** Creates an empty {@link Stream} that can be driven manually. */
export function createStream<T>(): Stream<T> {
  return new Stream<T>();
}

/**
 * Adapts an `AsyncIterable` into a {@link Stream}, pulling values from the
 * iterator and pushing them onto the stream until it is exhausted or throws.
 *
 * When `cleanups` is given, a function is added to it that stops pulling and
 * calls the iterator's `return` method. Call it when the stream is no longer
 * needed, for example when serialization is aborted.
 */
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

  // Pull in a loop rather than recursing, so a long iterable does not keep an
  // async call chain alive for every value.
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
          return;
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

const createAsyncIterable = /* @__PURE__ */ ASYNC_ITERATOR_CONSTRUCTOR(
  SYM_ASYNC_ITERATOR,
  PROMISE_CONSTRUCTOR,
);

/**
 * Adapts a {@link Stream} into an async-iterable factory, so a stream can be
 * consumed with `for await`. Each call to the returned factory produces an
 * independent iterator over the stream's values.
 */
export function streamToAsyncIterable<T>(
  stream: Stream<T> | LiveStream<T>,
): () => AsyncIterableIterator<T> {
  return createAsyncIterable(stream) as unknown as () => AsyncIterableIterator<T>;
}
