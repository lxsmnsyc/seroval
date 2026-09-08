import {
  ASYNC_ITERATOR_CONSTRUCTOR,
  PROMISE_CONSTRUCTOR,
  STREAM_CONSTRUCTOR,
} from './constructors';
import { SYM_ASYNC_ITERATOR } from './symbols';

export interface StreamListener<T> {
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
  return STREAM_CONSTRUCTOR() as unknown as Stream<T>;
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
