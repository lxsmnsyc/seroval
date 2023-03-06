export default function isPromise<T>(obj: unknown): obj is PromiseLike<T> {
  return !!obj
    && (typeof obj === 'object' || typeof obj === 'function')
    && 'then' in obj
    && typeof obj.then === 'function';
}
