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

export function sequenceToIterator<T>(sequence: Sequence): IterableIterator<T> {
  let index = 0;

  return {
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
    [Symbol.iterator](): IterableIterator<T> {
      return this;
    },
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

export function sequenceToAsyncIterator<T>(sequence: Sequence): AsyncIterableIterator<T> {
  let index = 0;

  return {
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
    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      return this;
    },
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
