import { Feature } from '../compat';
import { ERROR_CONSTRUCTOR_STRING, ErrorConstructorTag } from '../constants';

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

function getInitialErrorOptions(error: Error): Record<string, unknown> {
  const options: Record<string, unknown> = Object.create(null);
  const construct = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
  // Name has been modified
  if (error.name !== construct) {
    options.name = error.name;
  } else if (error.constructor.name !== construct) {
    // Otherwise, name is overriden because
    // the Error class is extended
    options.name = error.constructor.name;
  }
  return options;
}

export function getErrorOptions(
  error: Error,
  features: number,
): Record<string, unknown> | undefined {
  const options = getInitialErrorOptions(error);
  const names = Object.getOwnPropertyNames(error);
  for (let i = 0, len = names.length, name: string; i < len; i++) {
    name = names[i];
    if (name !== 'name' && name !== 'message') {
      if (name === 'stack') {
        if (features & Feature.ErrorPrototypeStack) {
          options[name] = error[name as keyof Error];
        }
      } else {
        options[name] = error[name as keyof Error];
      }
    }
  }
  return options;
}
