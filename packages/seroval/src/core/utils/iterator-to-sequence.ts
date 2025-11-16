import { ITERATOR_CONSTRUCTOR } from '../constructors';
import { SYM_ITERATOR } from '../symbols';

export interface Sequence {
  v: unknown[];
  t: number;
  d: number;
}

export function iteratorToSequence<T>(source: Iterable<T>): Sequence {
  const values: unknown[] = [];
  let throwsAt = -1;
  let doneAt = -1;

  const iterator = source[SYM_ITERATOR]();

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

const createIterator = ITERATOR_CONSTRUCTOR(SYM_ITERATOR);

export function sequenceToIterator<T>(
  sequence: Sequence,
): () => IterableIterator<T> {
  return createIterator(sequence) as unknown as () => IterableIterator<T>;
}
