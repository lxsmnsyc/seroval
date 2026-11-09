/**
 * Type guards for a plugin's `validate` field. A validator is a plain
 * type-guard function, so a plugin can also use a hand-written one.
 */
export type Validator<T> = (value: unknown) => value is T;

export const string: Validator<string> = (value): value is string => typeof value === 'string';

export const number: Validator<number> = (value): value is number => typeof value === 'number';

export const boolean: Validator<boolean> = (value): value is boolean => typeof value === 'boolean';

export const bigint: Validator<bigint> = (value): value is bigint => typeof value === 'bigint';

/** Matches an instance of the given constructor. */
export function instanceOf<T>(ctor: abstract new (...args: never[]) => T): Validator<T> {
  return (value): value is T => value instanceof ctor;
}

type Guarded<V> = V extends Validator<infer T> ? T : never;

/** Matches when any of the given validators match. */
export function union<V extends Validator<unknown>[]>(
  ...validators: V
): Validator<Guarded<V[number]>> {
  return (value): value is Guarded<V[number]> => {
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
  return (value): value is T | undefined => value === undefined || validator(value);
}

/** Matches an array whose items each match `item`. */
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
  [K in keyof S]: Guarded<S[K]>;
};

/**
 * Matches an object whose declared keys each pass their validator. Extra keys
 * are not checked.
 */
export function object<S extends Shape>(shape: S): Validator<Infer<S>> {
  const keys = Object.keys(shape);
  return (value): value is Infer<S> => {
    if (value == null || typeof value !== 'object') {
      return false;
    }
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i];
      if (!shape[key](Reflect.get(value, key))) {
        return false;
      }
    }
    return true;
  };
}
