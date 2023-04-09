import { Feature } from '../compat';
import { ParserContext } from '../context';
import {
  AsyncServerValue,
  ErrorValue,
} from '../types';

export function getErrorConstructorName(error: ErrorValue) {
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

export function getErrorConstructor(errorName: string) {
  switch (errorName) {
    case 'Error': return Error;
    case 'EvalError': return EvalError;
    case 'RangeError': return RangeError;
    case 'ReferenceError': return ReferenceError;
    case 'SyntaxError': return SyntaxError;
    case 'TypeError': return TypeError;
    case 'URIError': return URIError;
    default:
      throw new Error(`Unknown Error constructor "${errorName}"`);
  }
}

export function getErrorOptions(
  ctx: ParserContext,
  error: Error,
) {
  let options: Record<string, any> | undefined;
  const constructor = getErrorConstructorName(error);
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
      if (name === 'stack') {
        if (ctx.features & Feature.ErrorPrototypeStack) {
          options = options || {};
          options[name] = error[name as keyof Error];
        }
      } else {
        options = options || {};
        options[name] = error[name as keyof Error];
      }
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

export function getTypedArrayConstructor(name: string) {
  switch (name) {
    case 'Int8Array': return Int8Array;
    case 'Int16Array': return Int16Array;
    case 'Int32Array': return Int32Array;
    case 'Uint8Array': return Uint8Array;
    case 'Uint16Array': return Uint16Array;
    case 'Uint32Array': return Uint32Array;
    case 'Uint8ClampedArray': return Uint8ClampedArray;
    case 'Float32Array': return Float32Array;
    case 'Float64Array': return Float64Array;
    case 'BigInt64Array': return BigInt64Array;
    case 'BigUint64Array': return BigUint64Array;
    default:
      throw new Error(`Unknown TypedArray "${name}"`);
  }
}

const IDENTIFIER_CHECK = /^[$A-Z_][0-9A-Z_$]*$/i;

export function isValidIdentifier(name: string) {
  const char = name[0];
  return (
    char === '$'
    || char === '_'
    || (char >= 'A' && char <= 'Z')
    || (char >= 'a' && char <= 'z')
  ) && IDENTIFIER_CHECK.test(name);
}
