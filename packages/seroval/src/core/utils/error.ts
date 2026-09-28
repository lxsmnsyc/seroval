import { FeatureFlag } from '../compat';
import {
  ERROR_CONSTRUCTOR,
  ERROR_CONSTRUCTOR_STRING,
  ErrorConstructorTag,
} from '../constants';

type ErrorValue =
  | Error
  | AggregateError
  | EvalError
  | RangeError
  | ReferenceError
  | TypeError
  | SyntaxError
  | URIError;

export function getErrorConstructor(error: ErrorValue): ErrorConstructorTag {
  // The subclasses are siblings, so any order works; plain Error at tag 0
  // is the fallback and is skipped.
  for (
    let i: ErrorConstructorTag = ErrorConstructorTag.EvalError;
    i <= ErrorConstructorTag.URIError;
    i++
  ) {
    if (error instanceof ERROR_CONSTRUCTOR[i]) {
      return i;
    }
  }
  return ErrorConstructorTag.Error;
}

export function getErrorOptions(
  error: Error,
  features: number,
): Record<string, unknown> | undefined {
  const options: Record<string, unknown> = Object.create(null);
  const construct = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
  if (error.name !== construct) {
    options.name = error.name;
  } else if (error.constructor.name !== construct) {
    options.name = error.constructor.name;
  }
  for (const name of Object.getOwnPropertyNames(error)) {
    if (
      name !== 'name' &&
      name !== 'message' &&
      (name !== 'stack' || features & FeatureFlag.ErrorPrototypeStack)
    ) {
      options[name] = error[name as keyof Error];
    }
  }
  return options;
}
