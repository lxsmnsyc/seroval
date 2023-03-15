import { AsyncServerValue, PrimitiveValue } from './types';

export function isPrimitive(current: unknown): current is PrimitiveValue {
  if (!current || current === true) {
    return true;
  }
  const type = typeof current;
  return type === 'number'
    || type === 'string';
}

export function isPromise<T>(obj: unknown): obj is PromiseLike<T> {
  return !!obj
    && (typeof obj === 'object' || typeof obj === 'function')
    && 'then' in obj
    && typeof obj.then === 'function';
}

function isIterableBuiltin(obj: AsyncServerValue) {
  if (!!obj && typeof obj === 'object') {
    const cons = obj.constructor;
    return (
      Array.isArray(obj)
      || cons === Set
      || cons === Map
    );
  }
  return false;
}

export function isIterable(obj: AsyncServerValue): obj is Iterable<AsyncServerValue> {
  return !!obj
    && typeof obj === 'object'
    && !isIterableBuiltin(obj)
    && Symbol.iterator in obj
    && typeof obj[Symbol.iterator] === 'function';
}
