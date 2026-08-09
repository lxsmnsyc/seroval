import {
  ASYNC_ITERATOR_CONSTRUCTOR,
  PROMISE_CONSTRUCTOR,
  STREAM_CONSTRUCTOR,
} from './constructors';
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
 * A push-based stream that seroval can serialize. Unlike an async iterable, a
 * `Stream` multicasts: every listener registered with {@link Stream.on}
 * receives the values already buffered followed by the ones still to come.
 * Drive it with {@link Stream.next}, {@link Stream.throw} and
 * {@link Stream.return}.
 */
export interface Stream<T> {
  /** Brand used by {@link isStream} to recognize a stream at runtime. */
  __SEROVAL_STREAM__: true;

  /**
   * Subscribes `listener` to the stream, replaying buffered values first.
   * @returns A function that unsubscribes the listener.
   */
  on(listener: StreamListener<T>): () => void;

  /** Pushes a value to every listener. */
  next(value: T): void;
  /** Ends the stream with an error. */
  throw(value: unknown): void;
  /** Ends the stream normally with a final value. */
  return(value: T): void;
}

/** Returns whether `value` is a seroval {@link Stream}. */
export function isStream<T>(value: object): value is Stream<T> {
  return '__SEROVAL_STREAM__' in value;
}

/** Creates an empty {@link Stream} that can be driven manually. */
export function createStream<T>(): Stream<T> {
  return STREAM_CONSTRUCTOR() as unknown as Stream<T>;
}

/**
 * Adapts an `AsyncIterable` into a {@link Stream}, pulling values from the
 * iterator and pushing them onto the stream until it is exhausted or throws.
 */
export function createStreamFromAsyncIterable<T>(
  iterable: AsyncIterable<T>,
): Stream<T> {
  const stream = createStream<T>();

  const iterator = iterable[SYM_ASYNC_ITERATOR]();

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

const createAsyncIterable = ASYNC_ITERATOR_CONSTRUCTOR(
  SYM_ASYNC_ITERATOR,
  PROMISE_CONSTRUCTOR,
);

/**
 * Adapts a {@link Stream} into an async-iterable factory, so a stream can be
 * consumed with `for await`. Each call to the returned factory produces an
 * independent iterator over the stream's values.
 */
export function streamToAsyncIterable<T>(
  stream: Stream<T>,
): () => AsyncIterableIterator<T> {
  return createAsyncIterable(
    stream,
  ) as unknown as () => AsyncIterableIterator<T>;
}
