interface StreamListener<T = any> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export interface Stream<T = any> {
  __SEROVAL_STREAM__: true;

  on(listener: StreamListener<T>): () => void;

  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export function isStream<T>(value: object): value is Stream<T> {
  return '__SEROVAL_STREAM__' in value;
}

export interface StreamInit {
  b: unknown[]; // buffer
  a: boolean; // alive
  s: boolean; // success
}

export function createStream<T = any>(init: StreamInit): Stream<T> {
  const listeners = new Set<StreamListener<T>>();

  function flushNext(value: T): void {
    for (const listener of listeners.keys()) {
      listener.next(value);
    }
  }

  function flushThrow(value: unknown): void {
    for (const listener of listeners.keys()) {
      listener.throw(value);
    }
  }

  function flushReturn(value: T): void {
    for (const listener of listeners.keys()) {
      listener.return(value);
    }
  }

  return {
    __SEROVAL_STREAM__: true,
    on(listener: StreamListener<T>): () => void {
      listeners.add(listener);
      for (let i = 0, len = init.b.length; i < len; i++) {
        const value = init.b[i];
        if (i === len - 1) {
          if (init.s) {
            listener.return(value as T);
          } else {
            listener.throw(value);
          }
        } else {
          listener.next(value as T);
        }
      }
      return () => {
        listeners.delete(listener);
      };
    },
    next(value): void {
      if (init.a) {
        init.b.push(value);
        flushNext(value);
      }
    },
    throw(value): void {
      if (init.a) {
        init.b.push(value);
        flushThrow(value);
        init.a = false;
        init.s = false;
      }
    },
    return(value): void {
      if (init.a) {
        init.b.push(value);
        flushReturn(value);
        init.a = false;
        init.s = true;
      }
    },
  };
}

export async function toStreamInit<T = any>(stream: Stream<T>): Promise<StreamInit> {
  return new Promise<StreamInit>((res) => {
    const buffer: unknown[] = [];
    stream.on({
      next(value) {
        buffer.push(value);
      },
      throw(value) {
        buffer.push(value);
        res({
          b: buffer,
          a: false,
          s: false,
        });
      },
      return(value) {
        buffer.push(value);
        res({
          b: buffer,
          a: false,
          s: true,
        });
      },
    });
  });
}
