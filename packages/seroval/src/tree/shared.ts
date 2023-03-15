import {
  AsyncServerValue,
  ErrorValue,
} from '../types';

export function getErrorConstructor(error: ErrorValue) {
  if (error instanceof EvalError) {
    return 'EvalError';
  }
  if (error instanceof RangeError) {
    return 'RangeError';
  }
  if (error instanceof ReferenceError) {
    return 'ReferenceError';
  }
  if (error instanceof SyntaxError) {
    return 'SyntaxError';
  }
  if (error instanceof TypeError) {
    return 'TypeError';
  }
  if (error instanceof URIError) {
    return 'URIError';
  }
  return 'Error';
}

export function getErrorOptions(
  error: Error,
) {
  let options: Record<string, any> | undefined;
  const constructor = getErrorConstructor(error);
  // Name has been modified
  if (error.name !== constructor) {
    options = { name: error.name };
  } else if (error.constructor.name !== constructor) {
    // Otherwise, name is overriden because
    // the Error class is extended
    options = { name: error.constructor.name };
  }
  const names = Object.getOwnPropertyNames(error);
  for (const name of names) {
    if (name !== 'name' && name !== 'message') {
      options = options || {};
      options[name] = error[name as keyof Error];
    }
  }
  return options;
}

export function getIterableOptions(obj: Iterable<any>) {
  const names = Object.getOwnPropertyNames(obj);
  if (names.length) {
    const options: Record<string, unknown> = {};
    for (const name of names) {
      options[name] = obj[name as unknown as keyof typeof obj];
    }
    return options;
  }
  return undefined;
}

export function isIterable(
  value: unknown,
): value is Iterable<AsyncServerValue> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  switch (value.constructor) {
    case Map:
    case Set:
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
    case BigInt64Array:
    case BigUint64Array:
      return false;
    default:
      break;
  }
  return Symbol.iterator in value;
}
