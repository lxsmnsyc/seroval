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
  let done = true;
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
      if (done) {
        listeners.add(listener);
      }
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
        if (done) {
          listeners.delete(listener);
        }
      };
    },
    next(value): void {
      if (done) {
        buffer.push(value);
        flushNext(value);
      }
    },
    throw(value): void {
      if (done) {
        buffer.push(value);
        flushThrow(value);
        done = false;
        success = false;
        listeners.clear();
      }
    },
    return(value): void {
      if (done) {
        buffer.push(value);
        flushReturn(value);
        done = false;
        success = true;
        listeners.clear();
      }
    },
  };
}
