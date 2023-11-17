export interface Sequence {
  v: unknown[];
  t: number;
  d: number;
}

export function iteratorToSequence<T>(source: Iterable<T>): Sequence {
  const values: unknown[] = [];
  let throwsAt = -1;
  let doneAt = -1;

  const iterator = source[Symbol.iterator]();

  while (true) {
    try {
      const value = iterator.next();
      values.push(value.value);
      if (value.done) {
        doneAt = values.length - 1;
        break;
      }
    } catch (error) {
      throwsAt = values.length;
      values.push(error);
    }
  }

  return {
    v: values,
    t: throwsAt,
    d: doneAt,
  };
}

export function sequenceToIterator<T>(
  sequence: Sequence,
): () => IterableIterator<T> {
  return (): IterableIterator<T> => {
    let index = 0;

    return {
      [Symbol.iterator](): IterableIterator<T> {
        return this;
      },
      next(): IteratorResult<T> {
        if (index > sequence.d) {
          return {
            done: true,
            value: undefined,
          };
        }
        const currentIndex = index++;
        const currentItem = sequence.v[currentIndex];
        if (currentIndex === sequence.t) {
          throw currentItem;
        }
        return {
          done: currentIndex === sequence.d,
          value: currentItem as T,
        };
      },
    };
  };
}

export async function asyncIteratorToSequence<T>(source: AsyncIterable<T>): Promise<Sequence> {
  const values: unknown[] = [];
  let throwsAt = -1;
  let doneAt = -1;

  const iterator = source[Symbol.asyncIterator]();

  async function push(): Promise<void> {
    try {
      const value = await iterator.next();
      values.push(value.value);
      if (value.done) {
        doneAt = values.length - 1;
      } else {
        await push();
      }
    } catch (error) {
      throwsAt = values.length;
      values.push(error);
    }
  }

  await push();

  return {
    v: values,
    t: throwsAt,
    d: doneAt,
  };
}

export function sequenceToAsyncIterator<T>(
  sequence: Sequence,
): () => AsyncIterableIterator<T> {
  return (): AsyncIterableIterator<T> => {
    let index = 0;
    return {
      [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return this;
      },
      async next(): Promise<IteratorResult<T>> {
        if (index > sequence.d) {
          return {
            done: true,
            value: undefined,
          };
        }
        const currentIndex = index++;
        const currentItem = sequence.v[currentIndex];
        if (currentIndex === sequence.t) {
          throw currentItem;
        }
        return Promise.resolve({
          done: currentIndex === sequence.d,
          value: currentItem as T,
        });
      },
    };
  };
}

export function asyncIteratorToReadableStream<T>(
  source: AsyncIterable<T>,
): ReadableStream<unknown> {
  return new ReadableStream({
    async start(controller): Promise<void> {
      const iterator = source[Symbol.asyncIterator]();
      async function push(): Promise<void> {
        try {
          const result = await iterator.next();
          controller.enqueue([result.done ? 2 : 0, result.value]);
          if (result.done) {
            controller.close();
          } else {
            await push();
          }
        } catch (error) {
          controller.enqueue([1, error]);
        }
      }
      await push();
    },
  });
}

type RSNext<T> = [0, T];
type RSThrow = [1, any];
type RSReturn<T> = [2, T];

export type SerializedAsyncIteratorResult<T> = RSNext<T> | RSThrow | RSReturn<T>;

export function readableStreamToAsyncIterator<T>(
  source: ReadableStream<SerializedAsyncIteratorResult<T>>,
): () => AsyncIterableIterator<T> {
  let current = source;
  return (): AsyncIterableIterator<T> => {
    const [left, right] = current.tee();
    const clone = left;
    current = right;
    const reader = clone.getReader();
    return {
      [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return this;
      },
      async next(): Promise<IteratorResult<T>> {
        const result = await reader.read();
        if (result.done) {
          return {
            done: true,
            value: undefined,
          };
        }
        const [status, value] = result.value;
        if (status === 1) {
          throw value;
        }
        return {
          done: status === 2,
          value,
        };
      },
    };
  };
}

export async function readableStreamToSequence<T>(
  stream: ReadableStream<T>,
): Promise<Sequence> {
  const values: unknown[] = [];
  let throwsAt = -1;
  let doneAt = -1;

  const iterator = stream.getReader();

  async function push(): Promise<void> {
    try {
      const value = await iterator.read();
      values.push(value.value);
      if (value.done) {
        doneAt = values.length - 1;
      } else {
        await push();
      }
    } catch (error) {
      throwsAt = values.length;
      values.push(error);
    }
  }

  await push();

  return {
    v: values,
    t: throwsAt,
    d: doneAt,
  };
}
