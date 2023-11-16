import type {
  ErrorValue,
} from '../../types';
import { Feature } from '../compat';
import {
  ERROR_CONSTRUCTOR_STRING,
  ErrorConstructorTag,
} from '../constants';

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
