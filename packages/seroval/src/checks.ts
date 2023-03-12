import { PrimitiveValue } from './types';

export function isPrimitive(current: unknown): current is PrimitiveValue {
  if (!current || current === true) {
    return true;
  }
  const type = typeof current;
  return type === 'number'
    || type === 'string'
    || type === 'bigint';
}

export function isPromise<T>(obj: unknown): obj is PromiseLike<T> {
  return !!obj
    && (typeof obj === 'object' || typeof obj === 'function')
    && 'then' in obj
    && typeof obj.then === 'function';
}

export function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return !!obj
    && typeof obj === 'object'
    && Symbol.iterator in obj
    && typeof obj[Symbol.iterator] === 'function';
}
