import { SerovalTransportError } from '@seroval/transport';
import { RpcClosedError, RpcRemoteError, RpcTransportError } from '../errors';
import { isRemoteGenerator } from '../generators/plugin';

/** What the reader side tells the writer about the streams of one value. */
export interface StreamHooks {
  /** `count` items were consumed. */
  credit(count: number): void;
  /** Every stream of the value ended and at least one was abandoned. */
  cancel(): void;
}

interface Watch {
  readonly hooks: StreamHooks;
  readonly threshold: number;
  /** Streams that are not finished. */
  open: number;
  /** Whether a stream was left before its end. */
  abandoned: boolean;
  /** Items consumed that were not credited yet. */
  consumed: number;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  );
}

/**
 * Turns an error that came out of a stream into an rpc error. Only `name` and
 * `message` of a remote error are kept.
 */
export function toStreamError(error: unknown): Error {
  if (
    error instanceof RpcRemoteError ||
    error instanceof RpcClosedError ||
    error instanceof RpcTransportError
  ) {
    return error;
  }
  if (error instanceof SerovalTransportError) {
    return new RpcTransportError(error.message);
  }
  if (typeof error === 'object' && error !== null) {
    const fields = error as { name?: unknown; message?: unknown };
    return new RpcRemoteError(
      typeof fields.name === 'string' ? fields.name : 'Error',
      typeof fields.message === 'string' ? fields.message : 'The stream failed.',
    );
  }
  return new RpcRemoteError('Error', String(error));
}

function finish(watch: Watch, abandon: boolean): void {
  watch.open--;
  if (abandon) {
    watch.abandoned = true;
  }
  if (watch.open === 0 && watch.abandoned) {
    watch.hooks.cancel();
  }
}

function consume(watch: Watch): void {
  watch.consumed++;
  if (watch.consumed >= watch.threshold) {
    const count = watch.consumed;
    watch.consumed = 0;
    watch.hooks.credit(count);
  }
}

function wrapStream(watch: Watch, stream: AsyncIterable<unknown>): void {
  const start = stream[Symbol.asyncIterator];
  watch.open++;
  let ended = false;

  function end(abandon: boolean): void {
    if (!ended) {
      ended = true;
      finish(watch, abandon);
    }
  }

  const wrapped = function wrapped(): AsyncIterator<unknown> {
    const inner = start.call(stream);
    const iterator: AsyncIterator<unknown> & AsyncIterable<unknown> = {
      // Async, so a source that throws without a promise is caught too.
      async next(...args) {
        try {
          const result = await inner.next(...args);
          if (result.done) {
            end(false);
          } else {
            consume(watch);
          }
          return result;
        } catch (error) {
          end(false);
          throw toStreamError(error);
        }
      },
      async return(value?: unknown) {
        end(true);
        try {
          return (await inner.return?.(value)) ?? { done: true, value };
        } catch (error) {
          throw toStreamError(error);
        }
      },
      async throw(error) {
        end(true);
        try {
          if (!inner.throw) {
            throw error;
          }
          return await inner.throw(error);
        } catch (thrown) {
          throw toStreamError(thrown);
        }
      },
      [Symbol.asyncIterator]() {
        return iterator;
      },
    };
    return iterator;
  };
  try {
    Object.defineProperty(stream, Symbol.asyncIterator, {
      value: wrapped,
      configurable: true,
      writable: true,
    });
  } catch {
    // A frozen stream cannot report; give the window back for it.
    watch.open--;
  }
}

/** The objects inside `value` that a stream can hide in. */
function* children(value: object): Generator<unknown, void> {
  if (Array.isArray(value)) {
    yield* value;
  } else if (value instanceof Map) {
    for (const [key, item] of value) {
      yield key;
      yield item;
    }
  } else if (value instanceof Set) {
    yield* value;
  } else {
    yield* Object.values(value);
  }
}

/**
 * Finds the async iterables in a value the other end sent, and wraps them so
 * that consuming an item gives credit back and leaving one early cancels the
 * value. It looks inside arrays, plain objects, maps and sets, and leaves
 * remote generators alone.
 */
export function watchStreams(root: unknown, window: number, hooks: StreamHooks): void {
  const watch: Watch = {
    hooks,
    threshold: Math.max(1, window >> 1),
    open: 0,
    abandoned: false,
    consumed: 0,
  };
  const seen = new Set<unknown>();
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (typeof value !== 'object' || value === null || seen.has(value)) {
      continue;
    }
    seen.add(value);
    // Each step of a remote generator is a call, so it takes no credit.
    if (isRemoteGenerator(value)) {
      continue;
    }
    if (isAsyncIterable(value)) {
      wrapStream(watch, value);
      continue;
    }
    for (const child of children(value)) {
      stack.push(child);
    }
  }
}
