import type { Stream } from './stream';

type SpecialPromise = Promise<unknown> & { s?: 1 | 2; v?: unknown };

interface PromiseConstructorResolver {
  p: SpecialPromise;
  s: (value: unknown) => void;
  f: (value: unknown) => void;
}

export const PROMISE_CONSTRUCTOR = (
  resolver: PromiseConstructorResolver,
): Promise<unknown> => {
  resolver.p = new Promise((resolve, reject) => {
    resolver.s = resolve;
    resolver.f = reject;
  });
  return resolver.p;
};

export const PROMISE_SUCCESS = (
  resolver: PromiseConstructorResolver,
  data: unknown,
): void => {
  resolver.s(data);
  resolver.p!.s = 1;
  resolver.p!.v = data;
};

export const PROMISE_FAILURE = (
  resolver: PromiseConstructorResolver,
  data: unknown,
): void => {
  resolver.f(data);
  resolver.p!.s = 2;
  resolver.p!.v = data;
};

export const SERIALIZED_PROMISE_CONSTRUCTOR =
  /* @__PURE__ */ PROMISE_CONSTRUCTOR.toString();
export const SERIALIZED_PROMISE_SUCCESS =
  /* @__PURE__ */ PROMISE_SUCCESS.toString();
export const SERIALIZED_PROMISE_FAILURE =
  /* @__PURE__ */ PROMISE_FAILURE.toString();

interface StreamListener<T> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export const STREAM_CONSTRUCTOR = (
  buffer: unknown[] = [],
  alive = true,
  success = false,
  listeners: StreamListener<unknown>[] = [],
  count = 0,
  flush = (value: unknown, mode: keyof StreamListener<unknown>, x?: number) => {
    for (x = 0; x < count; x++) {
      if (listeners[x]) {
        listeners[x][mode](value);
      }
    }
  },
  up = (
    listener: StreamListener<unknown>,
    x?: number,
    z?: number,
    current?: unknown,
  ) => {
    for (x = 0, z = buffer.length; x < z; x++) {
      current = buffer[x];
      if (!alive && x === z - 1) {
        listener[success ? 'return' : 'throw'](current);
      } else {
        listener.next(current);
      }
    }
  },
  on = (listener: StreamListener<unknown>, temp?: number) => {
    if (alive) {
      temp = count++;
      listeners[temp] = listener;
    }
    up(listener);
    return () => {
      if (alive) {
        listeners[temp!] = listeners[count];
        listeners[count--] = undefined as any;
      }
    };
  },
) => ({
  __SEROVAL_STREAM__: true,
  on: (listener: StreamListener<unknown>) => on(listener),
  next: (value: unknown) => {
    if (alive) {
      buffer.push(value);
      flush(value, 'next');
    }
  },
  throw: (value: unknown) => {
    if (alive) {
      buffer.push(value);
      flush(value, 'throw');
      alive = false;
      success = false;
      listeners.length = 0;
    }
  },
  return: (value: unknown) => {
    if (alive) {
      buffer.push(value);
      flush(value, 'return');
      alive = false;
      success = true;
      listeners.length = 0;
    }
  },
});

export const SERIALIZED_STREAM_CONSTRUCTOR =
  /* @__PURE__ */ STREAM_CONSTRUCTOR.toString();

export interface Sequence {
  v: unknown[];
  t: number;
  d: number;
}

export const ITERATOR_CONSTRUCTOR =
  (symbol: symbol) =>
  (sequence: Sequence) =>
  (index: number, currentIndex: number, instance: unknown, data: unknown) => {
    index = 0;
    instance = {
      [symbol]: () => instance,
      next: () => {
        if (index > sequence.d) {
          return {
            done: true,
            value: undefined,
          };
        }
        currentIndex = index++;
        data = sequence.v[currentIndex];
        if (currentIndex === sequence.t) {
          throw data;
        }
        return {
          done: currentIndex === sequence.d,
          value: data,
        };
      },
    };
    return instance;
  };

export const SERIALIZED_ITERATOR_CONSTRUCTOR = ITERATOR_CONSTRUCTOR.toString();

export const ASYNC_ITERATOR_CONSTRUCTOR =
  (symbol: symbol, createPromise: typeof PROMISE_CONSTRUCTOR) =>
  (stream: Stream<unknown>) =>
  (
    instance: unknown,
    buffer: unknown[] = [],
    count = 0,
    pending: PromiseConstructorResolver[] = [],
    doneAt = -1,
    isThrow = false,
    finalize = (i = 0, len = pending.length) => {
      for (; i < len; i++) {
        pending[i].s({
          done: true,
          value: undefined,
        });
      }
    },
  ) => {
    stream.on({
      next: value => {
        const temp = pending.shift();
        if (temp) {
          temp.s({ done: false, value });
        }
        buffer.push(value);
      },
      throw: value => {
        const temp = pending.shift();
        if (temp) {
          temp.f(value);
        }
        finalize();
        doneAt = buffer.length;
        isThrow = true;
        buffer.push(value);
      },
      return: value => {
        const temp = pending.shift();
        if (temp) {
          temp.s({ done: true, value });
        }
        finalize();
        doneAt = buffer.length;
        buffer.push(value);
      },
    });

    instance = {
      [symbol]: () => instance,
      next: (
        index: number,
        temp: PromiseConstructorResolver,
        value: unknown,
      ) => {
        if (doneAt === -1) {
          index = count++;
          if (index >= buffer.length) {
            temp = {
              p: 0,
              s: 0,
              f: 0,
            } as unknown as PromiseConstructorResolver;
            createPromise(temp);
            pending.push(temp);
            return temp.p;
          }
          return {
            done: false,
            value: buffer[index],
          };
        }
        if (count > doneAt) {
          return {
            done: true,
            value: undefined,
          };
        }
        index = count++;
        value = buffer[index];
        if (index !== doneAt) {
          return {
            done: false,
            value,
          };
        }
        if (isThrow) {
          throw value;
        }
        return {
          done: true,
          value,
        };
      },
    };

    return instance;
  };

export const SERIALIZED_ASYNC_ITERATOR_CONSTRUCTOR =
  ASYNC_ITERATOR_CONSTRUCTOR.toString();
