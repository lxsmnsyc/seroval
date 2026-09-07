/**
 * Small, composable type guards for validating a plugin's deserialized values
 * before the plugin trusts them. A validator is a plain type-guard function, so
 * a plugin author can also hand-write one; these helpers just make the common
 * shapes trivial and correct.
 */
export type Validator<T> = (value: unknown) => value is T;

export const string: Validator<string> = (value): value is string =>
  typeof value === 'string';

export const number: Validator<number> = (value): value is number =>
  typeof value === 'number';

export const boolean: Validator<boolean> = (value): value is boolean =>
  typeof value === 'boolean';

export const bigint: Validator<bigint> = (value): value is bigint =>
  typeof value === 'bigint';

/** Matches a `Promise` or any thenable. */
export const thenable: Validator<PromiseLike<unknown>> = (
  value,
): value is PromiseLike<unknown> =>
  !!value &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { then?: unknown }).then === 'function';

export const arrayBuffer: Validator<ArrayBuffer> = (
  value,
): value is ArrayBuffer => value instanceof ArrayBuffer;

/** Matches an instance of the given constructor. */
export function instanceOf<T>(ctor: new (...args: never[]) => T): Validator<T> {
  return (value): value is T => value instanceof ctor;
}

/** Matches when any of the given validators match. */
export function union<T>(...validators: Validator<T>[]): Validator<T> {
  return (value): value is T => {
    for (let i = 0, len = validators.length; i < len; i++) {
      if (validators[i](value)) {
        return true;
      }
    }
    return false;
  };
}

/** Matches the given validator or `undefined`. */
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (value): value is T | undefined =>
    value === undefined || validator(value);
}

/** Matches a homogeneous array whose items each match `item`. */
export function array<T>(item: Validator<T>): Validator<T[]> {
  return (value): value is T[] => {
    if (!Array.isArray(value)) {
      return false;
    }
    for (let i = 0, len = value.length; i < len; i++) {
      if (!item(value[i])) {
        return false;
      }
    }
    return true;
  };
}

type Shape = Record<string, Validator<unknown>>;

type Infer<S extends Shape> = {
  [K in keyof S]: S[K] extends Validator<infer T> ? T : never;
};

/**
 * Matches a non-null object each of whose declared keys passes its validator.
 * Extra keys are ignored; the guard only asserts the declared shape.
 */
export function object<S extends Shape>(shape: S): Validator<Infer<S>> {
  const keys = Object.keys(shape);
  return (value): value is Infer<S> => {
    if (!value || typeof value !== 'object') {
      return false;
    }
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i];
      if (!shape[key]((value as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  };
}
