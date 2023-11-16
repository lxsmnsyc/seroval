export interface Deferred extends Promise<unknown> {
  resolve(value: unknown): void;
  reject(value: unknown): void;
}

export function createDeferred(): { promise: Deferred } {
  let resolve: Deferred['resolve'];
  let reject: Deferred['reject'];
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }) as Deferred;

  promise.resolve = (value): void => {
    resolve(value);
  };
  promise.reject = (value): void => {
    reject(value);
  };
  return { promise };
}
