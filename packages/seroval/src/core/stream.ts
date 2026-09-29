import { ASYNC_ITERATOR_CONSTRUCTOR, PROMISE_CONSTRUCTOR } from './constructors';
import { SYM_ASYNC_ITERATOR } from './symbols';

export interface StreamListener<T> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

// 0 = alive, 1 = returned, 2 = thrown.
type StreamStatus = 0 | 1 | 2;

interface StreamState<T> {
  buffer: unknown[] | undefined;
  listeners: (StreamListener<T> | undefined)[] | undefined;
  status: StreamStatus;
  count: number;
}

function emit<T>(
  state: StreamState<T>,
  value: unknown,
  mode: keyof StreamListener<T>,
  status: StreamStatus,
): void {
  if (!state.status) {
    if (!state.buffer) {
      state.buffer = [];
    }
    state.buffer.push(value);
    // A listener can end the stream during dispatch, so read storage each time.
    for (let x = 0; x < state.count; x++) {
      state.listeners?.[x]?.[mode](value as T);
    }
    if (status) {
      state.status = status;
      state.listeners = undefined;
    }
  }
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
 *
 * All mutable state lives in one private record, so a downleveled build keeps
 * one WeakMap entry per stream. The buffer and the listener list are allocated
 * on first use, and the listener list is released when the stream ends.
 */
export class Stream<T> {
  #state: StreamState<T> = {
    buffer: undefined,
    listeners: undefined,
    status: 0,
    count: 0,
  };

  on(listener: StreamListener<T>): () => void {
    const state = this.#state;
    let temp = -1;
    if (!state.status) {
      temp = state.count++;
      if (!state.listeners) {
        state.listeners = [];
      }
      state.listeners[temp] = listener;
    }
    const buffer = state.buffer;
    if (buffer) {
      for (let x = 0, z = buffer.length; x < z; x++) {
        const current = buffer[x];
        if (state.status && x === z - 1) {
          listener[state.status === 1 ? 'return' : 'throw'](current as T);
        } else {
          listener.next(current as T);
        }
      }
    }
    return () => {
      // The list exists exactly while the stream is alive and has registered.
      const listeners = state.listeners;
      if (listeners && temp !== -1) {
        listeners[temp] = listeners[state.count];
        listeners[state.count--] = undefined;
      }
    };
  }

  next(value: T): void {
    emit(this.#state, value, 'next', 0);
  }

  throw(value: unknown): void {
    emit(this.#state, value, 'throw', 2);
  }

  return(value: T): void {
    emit(this.#state, value, 'return', 1);
  }
}

export function isStream<T>(value: object): value is Stream<T> {
  return value instanceof Stream;
}

export function createStream<T>(): Stream<T> {
  return new Stream<T>();
}

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

export function streamToAsyncIterable<T>(
  stream: Stream<T>,
): () => AsyncIterableIterator<T> {
  return createAsyncIterable(
    stream,
  ) as unknown as () => AsyncIterableIterator<T>;
}
