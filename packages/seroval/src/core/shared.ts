import type {
  ErrorValue,
} from '../types';
import { ErrorConstructorTag, SerovalObjectFlags } from './constants';

export function getErrorConstructor(error: ErrorValue): ErrorConstructorTag {
  if (error instanceof EvalError) {
    return ErrorConstructorTag.EvalError;
  }
  if (error instanceof RangeError) {
    return ErrorConstructorTag.RangeError;
  }
  if (error instanceof ReferenceError) {
    return ErrorConstructorTag.ReferenceError;
  }
  if (error instanceof SyntaxError) {
    return ErrorConstructorTag.SyntaxError;
  }
  if (error instanceof TypeError) {
    return ErrorConstructorTag.TypeError;
  }
  if (error instanceof URIError) {
    return ErrorConstructorTag.URIError;
  }
  return ErrorConstructorTag.Error;
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
