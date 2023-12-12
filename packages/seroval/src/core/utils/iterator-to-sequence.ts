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
