import { WellKnownSymbols } from './tree/symbols';

// Values that are non-recursive
export type PrimitiveValue =
  | boolean
  | string
  | number
  | undefined
  | null
  | WellKnownSymbols;

export type ErrorValue =
  | Error
  | AggregateError
  | EvalError
  | RangeError
  | ReferenceError
  | TypeError
  | SyntaxError
  | URIError;

export type TypedArrayValue =
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;

export type BigIntTypedArrayValue =
  | BigInt64Array
  | BigUint64Array;

export type SemiPrimitiveValue =
  | RegExp
  | Date
  | TypedArrayValue
  | BigIntTypedArrayValue
  | bigint;

export type CommonServerValue =
  | PrimitiveValue
  | SemiPrimitiveValue
  | ErrorValue;

export type ServerValue =
  | CommonServerValue
  | Array<ServerValue>
  | readonly ServerValue[]
  | Iterable<ServerValue>
  | { [key: string | number]: ServerValue }
  | { readonly [key: string | number]: ServerValue }
  | Set<ServerValue>
  | Map<ServerValue, ServerValue>;

export type AsyncServerValue =
  | CommonServerValue
  | Array<AsyncServerValue>
  | readonly AsyncServerValue[]
  | Iterable<AsyncServerValue>
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
