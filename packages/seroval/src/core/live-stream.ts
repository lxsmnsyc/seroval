import { SerovalLiveStreamError } from './errors';
import type { StreamListener } from './stream';

export type LiveStreamEvent<T> =
  | { type: 'next'; value: T }
  | { type: 'return'; value: T }
  | { type: 'throw'; error: unknown };

export interface LiveStreamDelivery<T> {
  event: LiveStreamEvent<T>;
  /**
   * Release the event and resolve the producer operation that sent it.
   * Call it only after the serialized record for the event has been
   * accepted by its destination. Late or repeated calls are ignored.
   */
  accept(): void;
}

export interface LiveStreamConsumer<T> {
  read(): Promise<LiveStreamDelivery<T>>;
  cancel(reason?: unknown): void;
}

export interface LiveStreamProducer<T> {
  write(value: T): Promise<void>;
  close(value: T): Promise<void>;
  fail(error: unknown): Promise<void>;
}

/**
 * Receives events from `LiveStream.pump`. Each handler gets the event value
 * and the accept function for it, and returns `undefined` to keep going or
 * the error that stopped the sink. `error` runs if the stream is cancelled
 * while a read is pending.
 */
export interface LiveStreamSink<T> {
  next(value: T, accept: () => void): unknown;
  throw(value: unknown, accept: () => void): unknown;
  return(value: T, accept: () => void): unknown;
  /** Runs once after the terminal event, or after a handler failed. */
  done?(): void;
  /** Runs if the stream is cancelled while a read is pending. */
  error?(reason: unknown): void;
}

export interface LiveStream<T> {
  // Shares the replay stream's marker key so the parser needs one `in` check
  // per object; the value tells the two apart.
  __SEROVAL_STREAM__: 2;
  consume(): LiveStreamConsumer<T>;
  /**
   * Consumes the stream through a replay-style listener, accepting each
   * event as soon as it has been delivered. Used by the materializing
   * parsers; streaming serialization ties acceptance to output instead.
   */
  on(listener: StreamListener<T>): () => void;
  /**
   * Consumes the stream into a sink that controls acceptance. Returns the
   * cancel function.
   * @internal
   */
  pump(sink: LiveStreamSink<T>): (reason?: unknown) => void;
}

export interface LiveStreamOptions {
  onCancel?: (reason: unknown) => void;
}

interface PendingEvent<T> {
  event: LiveStreamEvent<T> | undefined;
  delivered: boolean;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

interface PendingRead<T> {
  resolve: (delivery: LiveStreamDelivery<T>) => void;
  reject: (reason: unknown) => void;
}

export function isLiveStream<T>(value: {
  __SEROVAL_STREAM__: unknown;
}): value is LiveStream<T> {
  return value.__SEROVAL_STREAM__ === 2;
}

/**
 * A single-consumer stream for incremental serialization. Unlike
 * `createStream`, it keeps no history: at most one event is held, and the
 * producer operation that sent it settles only when the consumer accepts it.
 */
export function createLiveStream<T>(options?: LiveStreamOptions): {
  stream: LiveStream<T>;
  producer: LiveStreamProducer<T>;
} {
  let pending: PendingEvent<T> | undefined;
  let waiting: PendingRead<T> | undefined;
  let consumed = false;
  let closed = false;
  let cancelled = false;
  let cancelReason: unknown;

  function deliver(read: PendingRead<T>, record: PendingEvent<T>): void {
    record.delivered = true;
    read.resolve({
      event: record.event as LiveStreamEvent<T>,
      accept() {
        if (pending === record && record.delivered) {
          const terminal = (record.event as LiveStreamEvent<T>).type !== 'next';
          record.event = undefined;
          pending = undefined;
          if (terminal) {
            closed = true;
          }
          record.resolve();
        }
      },
    });
  }

  function push(event: LiveStreamEvent<T>): Promise<void> {
    if (cancelled) {
      return Promise.reject(cancelReason);
    }
    if (closed) {
      return Promise.reject(new SerovalLiveStreamError('closed'));
    }
    if (pending) {
      return Promise.reject(new SerovalLiveStreamError('pending'));
    }
    return new Promise<void>((resolve, reject) => {
      const record: PendingEvent<T> = {
        event,
        delivered: false,
        resolve,
        reject,
      };
      pending = record;
      if (waiting) {
        const read = waiting;
        waiting = undefined;
        deliver(read, record);
      }
    });
  }

  function cancel(reason?: unknown): void {
    if (cancelled || closed) {
      return;
    }
    cancelled = true;
    cancelReason = reason;
    const record = pending;
    const read = waiting;
    pending = undefined;
    waiting = undefined;
    if (record) {
      record.event = undefined;
      record.reject(reason);
    }
    if (read) {
      read.reject(reason);
    }
    options?.onCancel?.(reason);
  }

  function read(): Promise<LiveStreamDelivery<T>> {
    if (cancelled) {
      return Promise.reject(cancelReason);
    }
    if (closed) {
      return Promise.reject(new SerovalLiveStreamError('closed'));
    }
    if (waiting) {
      return Promise.reject(new SerovalLiveStreamError('reading'));
    }
    return new Promise<LiveStreamDelivery<T>>((resolve, reject) => {
      const next: PendingRead<T> = { resolve, reject };
      if (pending && !pending.delivered) {
        deliver(next, pending);
      } else {
        waiting = next;
      }
    });
  }

  function consume(): LiveStreamConsumer<T> {
    if (consumed) {
      throw new SerovalLiveStreamError('consumed');
    }
    consumed = true;
    return { read, cancel };
  }

  function pump(sink: LiveStreamSink<T>): (reason?: unknown) => void {
    const consumer = consume();
    function next(): void {
      consumer.read().then(delivery => {
        const event = delivery.event;
        let failure: unknown;
        try {
          failure = (
            sink[event.type] as (value: unknown, accept: () => void) => unknown
          )(
            event.type === 'throw' ? event.error : event.value,
            delivery.accept,
          );
        } catch (error) {
          failure = error;
        }
        if (failure !== undefined) {
          consumer.cancel(failure);
        } else if (event.type === 'next') {
          next();
          return;
        }
        sink.done?.();
      }, sink.error);
    }
    next();
    return consumer.cancel;
  }

  return {
    stream: {
      __SEROVAL_STREAM__: 2,
      consume,
      on(listener) {
        const wrap =
          (key: keyof StreamListener<T>) =>
          (value: unknown, accept: () => void): void => {
            (listener[key] as (value: unknown) => void)(value);
            accept();
          };
        return pump({
          next: wrap('next'),
          throw: wrap('throw'),
          return: wrap('return'),
        });
      },
      pump,
    },
    producer: {
      write(value) {
        return push({ type: 'next', value });
      },
      close(value) {
        return push({ type: 'return', value });
      },
      fail(error) {
        return push({ type: 'throw', error });
      },
    },
  };
}
