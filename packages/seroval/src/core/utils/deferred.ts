export interface Deferred {
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(value: unknown): void;
}

export function createDeferred(): Deferred {
  let resolve: Deferred['resolve'];
  let reject: Deferred['reject'];
  return {
    promise: new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    }),
    resolve(value): void {
      resolve(value);
    },
    reject(value): void {
      reject(value);
    },
  };
}

export interface DeferredStream {
  stream: ReadableStream;
  close(): void;
  enqueue(chunk?: unknown): void;
  error(e?: any): void;
}

export function createDeferredStream(): DeferredStream {
  let controller: ReadableStreamDefaultController;
  return {
    stream: new ReadableStream({
      start(current): void {
        controller = current;
      },
    }),
    close(): void {
      controller.close();
    },
    enqueue(data): void {
      controller.enqueue(data);
    },
    error(e): void {
      controller.error(e);
    },
  };
}
