export interface Sequence {
  v: unknown[];
  t: number;
}

export function iteratorToSequence<T>(source: Iterable<T>): Sequence {
  const values: unknown[] = [];
  let throwsAt = -1;

  const iterator = source[Symbol.iterator]();

  while (true) {
    try {
      const value = iterator.next();
      values.push(value.value);
      if (value.done) {
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
  };
}

export function sequenceToIterator<T>(sequence: Sequence): Iterator<T> {
  let index = 0;

  return {
    next(): IteratorResult<T> {
      const currentIndex = index++;
      const currentItem = sequence.v[currentIndex];
      if (currentIndex === sequence.t) {
        throw currentItem;
      }
      return {
        done: currentIndex === sequence.v.length - 1,
        value: currentItem as T,
      };
    },
  };
}
