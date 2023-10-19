import type {
  ErrorValue,
} from '../types';
import { Feature } from './compat';
import {
  ERROR_CONSTRUCTOR_STRING,
  ErrorConstructorTag,
  SerovalObjectFlags,
} from './constants';

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

export function getErrorOptions(
  error: Error,
  features: number,
): Record<string, unknown> | undefined {
  let options: Record<string, unknown> | undefined;
  const constructor = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
  // Name has been modified
  if (error.name !== constructor) {
    options = { name: error.name };
  } else if (error.constructor.name !== constructor) {
    // Otherwise, name is overriden because
    // the Error class is extended
    options = { name: error.constructor.name };
  }
  const names = Object.getOwnPropertyNames(error);
  for (let i = 0, len = names.length, name: string; i < len; i++) {
    name = names[i];
    if (name !== 'name' && name !== 'message') {
      if (name === 'stack') {
        if (features & Feature.ErrorPrototypeStack) {
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
