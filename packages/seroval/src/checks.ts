import { AsyncServerValue, PrimitiveValue } from './types';

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

export function constructorCheck<T extends NonNullable<AsyncServerValue>>(
  value: NonNullable<AsyncServerValue>,
  constructor: unknown,
): value is T {
  return value.constructor === constructor;
}

function isIterableBuiltin(obj: unknown) {
  return (
    Array.isArray(obj)
    || constructorCheck<Set<any>>(obj, Set)
    || constructorCheck<Map<any, any>>(obj, Map)
  );
}

export function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return !!obj
    && typeof obj === 'object'
    && !isIterableBuiltin(obj)
    && Symbol.iterator in obj
    && typeof obj[Symbol.iterator] === 'function';
}
