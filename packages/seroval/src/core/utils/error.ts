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
      (name !== 'stack' || features & Feature.ErrorPrototypeStack)
    ) {
      options[name] = error[name as keyof Error];
    }
  }
  return options;
}
