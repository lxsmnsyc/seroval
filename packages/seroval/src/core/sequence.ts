import { ITERATOR_CONSTRUCTOR } from './constructors';
import { SYM_ITERATOR } from './symbols';

export interface Sequence {
  __SEROVAL_SEQUENCE__: true;

  v: unknown[];
  t: number;
  d: number;
}

export function isSequence(value: object): value is Sequence {
  return '__SEROVAL_SEQUENCE__' in value;
}

export function createSequence(
  values: unknown[],
  throwAt: number,
  doneAt: number,
): Sequence {
  return {
    __SEROVAL_SEQUENCE__: true,

    v: values,
    t: throwAt,
    d: doneAt,
  };
}

export function createSequenceFromIterable<T>(source: Iterable<T>): Sequence {
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
      // Stop at the first error. An iterator that keeps throwing would
      // otherwise never finish.
      throwsAt = values.length;
      doneAt = throwsAt;
      values.push(error);
      break;
    }
  }

  return createSequence(values, throwsAt, doneAt);
}

const createIterator = /* @__PURE__ */ ITERATOR_CONSTRUCTOR(SYM_ITERATOR);

export function sequenceToIterator<T>(
  sequence: Sequence,
): () => IterableIterator<T> {
  return createIterator(sequence) as unknown as () => IterableIterator<T>;
}
