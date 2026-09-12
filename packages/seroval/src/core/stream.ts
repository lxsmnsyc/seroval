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
