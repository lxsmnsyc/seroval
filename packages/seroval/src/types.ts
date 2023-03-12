// Values that are non-recursive
export type PrimitiveValue =
  | boolean
  | string
  | number
  | undefined
  | null
  | bigint;

export type ErrorValue =
  | Error
  | AggregateError
  | EvalError
  | RangeError
  | ReferenceError
  | TypeError
  | SyntaxError
  | URIError;

export type CommonServerValue =
  | PrimitiveValue
  | ErrorValue
  | RegExp
  | Date;

export type ServerValue =
  | CommonServerValue
  | Array<ServerValue>
  | readonly ServerValue[]
  | { [key: string | number]: ServerValue }
  | { readonly [key: string | number]: ServerValue }
  | Set<ServerValue>
  | Map<ServerValue, ServerValue>;

export type AsyncServerValue =
  | CommonServerValue
  | Array<AsyncServerValue>
  | readonly AsyncServerValue[]
  | { [key: string | number]: AsyncServerValue }
  | { readonly [key: string | number]: AsyncServerValue }
  | Set<AsyncServerValue>
  | Map<AsyncServerValue, AsyncServerValue>
  | PromiseLike<AsyncServerValue>;

export type NonPrimitiveServerValue<T> =
  T extends PrimitiveValue
    ? never
    : T;

export type MaybePromise<T> = T | Promise<T>;
