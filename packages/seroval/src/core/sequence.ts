import { ITERATOR_CONSTRUCTOR } from './constructors';
import { SYM_ITERATOR } from './symbols';

/**
 * An internal class rather than a tagged POJO: identity is checked with
 * `instanceof`, which untrusted input cannot forge. The class is exported
 * because bundlers cannot drop an unexported top-level class.
 * The eval-based `deserialize` path still rebuilds a `{__SEROVAL_SEQUENCE__…}`
 * POJO from embedded source - it has no access to this class - so a value read
 * back through `deserialize` is not an instance and, by design, is not treated
 * as a genuine Sequence on re-serialization.
 */
export class Sequence {
  v: unknown[];
  t: number;
  d: number;

  constructor(values: unknown[], throwAt: number, doneAt: number) {
    this.v = values;
    this.t = throwAt;
    this.d = doneAt;
  }
}

export function isSequence(value: unknown): value is Sequence {
  return value instanceof Sequence;
}

export function createSequence(values: unknown[], throwAt: number, doneAt: number): Sequence {
  return new Sequence(values, throwAt, doneAt);
}

export function createSequenceFromIterable<T>(source: Iterable<T>): Sequence {
  const values: unknown[] = [];
  let throwsAt = -1;
  let doneAt = -1;
  const iterator = source[SYM_ITERATOR]();

  for (;;) {
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

export function sequenceToIterator<T>(sequence: Sequence): () => IterableIterator<T> {
  return createIterator(sequence) as unknown as () => IterableIterator<T>;
}
