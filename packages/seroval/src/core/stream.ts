interface StreamListener<T> {
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export interface Stream<T> {
  __SEROVAL_STREAM__: true;

  on(listener: StreamListener<T>): () => void;

  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
}

export function isStream<T>(value: object): value is Stream<T> {
  return '__SEROVAL_STREAM__' in value;
}

export function createStream<T>(): Stream<T> {
  const listeners = new Set<StreamListener<T>>();
  const buffer: unknown[] = [];
  let alive = true;
  let success = false;

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
      for (let i = 0, len = buffer.length; i < len; i++) {
        const value = buffer[i];
        if (i === len - 1) {
          if (success) {
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
      if (alive) {
        buffer.push(value);
        flushNext(value);
      }
    },
    throw(value): void {
      if (alive) {
        buffer.push(value);
        flushThrow(value);
        alive = false;
        success = false;
      }
    },
    return(value): void {
      if (alive) {
        buffer.push(value);
        flushReturn(value);
        alive = false;
        success = true;
      }
    },
  };
}
