import type { Validator } from 'seroval/shared';

// Validators for the values that the web plugins hand to Web constructors. A
// constructor converts a plain object to a string or a number, so each field is
// checked to have the type the constructor expects.

type Entry<T> = [key: string, value: T];

// Values that a plugin copies or subscribes to. The parser builds a fresh one
// for every plugin value, so a value claimed twice means the input pointed
// several plugin values at it to make each one copy it again.
const CLAIMED = new WeakSet<object>();

export function claim<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    if (CLAIMED.has(value)) {
      throw new Error('Expected a value used by one plugin value only.');
    }
    CLAIMED.add(value);
  }
  return value;
}

// Matches an array of key-value pairs with string keys.
export function entries<T>(value: Validator<T>): Validator<Entry<T>[]> {
  return (list): list is Entry<T>[] => {
    if (!Array.isArray(list)) {
      return false;
    }
    for (const entry of list as unknown[]) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string' ||
        !value(entry[1])
      ) {
        return false;
      }
    }
    return true;
  };
}

// Copies an entry list into fresh pairs, so the constructor never iterates an
// array the input built.
export function copyEntries<T>(list: Entry<T>[]): Entry<T>[] {
  claim(list);
  const result: Entry<T>[] = [];
  for (const entry of list) {
    result.push([entry[0], entry[1]]);
  }
  return result;
}

export function isOptionalHeaders(value: unknown): value is Headers | undefined {
  return value === undefined || value instanceof Headers;
}

// Body values are limited to what the plugins emit, so a body is never
// converted to a string.
export function isBody(value: unknown): value is ArrayBuffer | ReadableStream | null | undefined {
  return (
    value == null ||
    value instanceof ArrayBuffer ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}
