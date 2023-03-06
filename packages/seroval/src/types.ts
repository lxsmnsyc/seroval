// Values that are non-recursive
export type PrimitiveValue =
  | boolean
  | string
  | number
  | undefined
  | null
  | bigint
  | Date
  | RegExp;

export type ServerValue =
  | PrimitiveValue
  | Array<ServerValue>
  | { [key: string | number]: ServerValue }
  | Set<ServerValue>
  | Map<ServerValue, ServerValue>;

export type AsyncServerValue =
  | PrimitiveValue
  | Array<AsyncServerValue>
  | { [key: string | number]: AsyncServerValue }
  | Set<AsyncServerValue>
  | Map<AsyncServerValue, AsyncServerValue>
  | PromiseLike<AsyncServerValue>;

export type NonPrimitiveServerValue<T> =
  T extends PrimitiveValue
    ? never
    : T;

export type MaybePromise<T> = T | Promise<T>;
