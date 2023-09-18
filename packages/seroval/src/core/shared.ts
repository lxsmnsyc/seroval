import { Feature } from './compat';
import type {
  ErrorValue,
} from '../types';
import { SerovalObjectFlags } from './constants';
import type { BaseParserContext } from './context';

export function getErrorConstructorName(error: ErrorValue): string {
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

type ErrorConstructors =
  | ErrorConstructor
  | EvalErrorConstructor
  | RangeErrorConstructor
  | ReferenceErrorConstructor
  | SyntaxErrorConstructor
  | TypeErrorConstructor
  | URIErrorConstructor;

export function getErrorConstructor(errorName: string): ErrorConstructors {
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
  ctx: BaseParserContext,
  error: Error,
): Record<string, unknown> | undefined {
  let options: Record<string, unknown> | undefined;
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

export function isIterable(
  value: unknown,
): value is Iterable<unknown> {
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

type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

export function getTypedArrayConstructor(name: string): TypedArrayConstructor {
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

export function isValidIdentifier(name: string): boolean {
  const char = name[0];
  return (
    char === '$'
    || char === '_'
    || (char >= 'A' && char <= 'Z')
    || (char >= 'a' && char <= 'z')
  ) && IDENTIFIER_CHECK.test(name);
}

export function getObjectFlag(obj: unknown): SerovalObjectFlags {
  if (Object.isFrozen(obj)) {
    return SerovalObjectFlags.Frozen;
  }
  if (Object.isSealed(obj)) {
    return SerovalObjectFlags.Sealed;
  }
  if (Object.isExtensible(obj)) {
    return SerovalObjectFlags.None;
  }
  return SerovalObjectFlags.NonExtensible;
}
