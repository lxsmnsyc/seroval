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

export interface LiveStreamOptions {
  onCancel?: (reason: unknown) => void;
}

interface PendingEvent<T> {
  event: LiveStreamEvent<T> | undefined;
  delivered: boolean;
  resolve: (() => void) | undefined;
  reject: ((reason: unknown) => void) | undefined;
}

interface PendingRead<T> {
  resolve: (delivery: LiveStreamDelivery<T>) => void;
  reject: (reason: unknown) => void;
}

// Brand instead of `instanceof`: JSON cannot forge a symbol key, and not naming the
// class lets bundles that never create a live stream drop it. Per module copy, like `instanceof`.
const BRAND = /* @__PURE__ */ Symbol('LiveStream');

export function isLiveStream<T>(value: unknown): value is LiveStream<T> {
  return value != null && (value as { [BRAND]?: unknown })[BRAND] === true;
}

/**
 * A single-consumer stream for incremental serialization. Unlike
 * `createStream`, it keeps no history: at most one event is held, and the
 * producer operation that sent it settles only when the consumer accepts it.
 *
 * An internal class rather than a tagged POJO: identity is checked with
 * `isLiveStream`, which untrusted input cannot forge. The class is exported
 * because bundlers cannot drop an unexported top-level class.
 */
export class LiveStream<T> {
  private readonly [BRAND] = true;
  private pending: PendingEvent<T> | undefined;
  private waiting: PendingRead<T> | undefined;
  private consumed = false;
  private closed = false;
  private cancelled = false;
  private cancelReason: unknown;
  private options: LiveStreamOptions | undefined;

  constructor(options?: LiveStreamOptions) {
    this.options = options;
  }

  private deliver(reader: PendingRead<T>, record: PendingEvent<T>): void {
    record.delivered = true;
    reader.resolve({
      event: record.event!,
      accept: () => {
        if (this.pending === record && record.delivered) {
          const terminal = record.event!.type !== 'next';
          record.event = undefined;
          this.pending = undefined;
          const resolve = record.resolve;
          record.resolve = undefined;
          record.reject = undefined;
          if (terminal) {
            this.closed = true;
            this.options = undefined;
            const waiter = this.waiting;
            this.waiting = undefined;
            waiter?.reject(new SerovalLiveStreamError('closed'));
          }
          resolve?.();
        }
      },
    });
  }

  /** @internal */
  push(event: LiveStreamEvent<T>): Promise<void> {
    if (this.cancelled) {
      // oxlint-disable-next-line prefer-promise-reject-errors -- Rejects with the cancel reason as given.
      return Promise.reject(this.cancelReason);
    }
    if (this.closed) {
      return Promise.reject(new SerovalLiveStreamError('closed'));
    }
    if (this.pending) {
      return Promise.reject(new SerovalLiveStreamError('pending'));
    }
    return new Promise<void>((resolve, reject) => {
      const record: PendingEvent<T> = {
        event,
        delivered: false,
        resolve,
        reject,
      };
      this.pending = record;
      if (this.waiting) {
        const waiter = this.waiting;
        this.waiting = undefined;
        this.deliver(waiter, record);
      }
    });
  }

  private cancel(reason?: unknown): void {
    if (this.cancelled || this.closed) {
      return;
    }
    this.cancelled = true;
    this.cancelReason = reason;
    const record = this.pending;
    const waiter = this.waiting;
    this.pending = undefined;
    this.waiting = undefined;
    const callbackOwner = this.options;
    this.options = undefined;
    if (record) {
      record.event = undefined;
      const reject = record.reject;
      record.resolve = undefined;
      record.reject = undefined;
      reject?.(reason);
    }
    if (waiter) {
      waiter.reject(reason);
    }
    callbackOwner?.onCancel?.(reason);
  }

  private read(): Promise<LiveStreamDelivery<T>> {
    if (this.cancelled) {
      // oxlint-disable-next-line prefer-promise-reject-errors -- Rejects with the cancel reason as given.
      return Promise.reject(this.cancelReason);
    }
    if (this.closed) {
      return Promise.reject(new SerovalLiveStreamError('closed'));
    }
    if (this.waiting) {
      return Promise.reject(new SerovalLiveStreamError('reading'));
    }
    return new Promise<LiveStreamDelivery<T>>((resolve, reject) => {
      const next: PendingRead<T> = { resolve, reject };
      if (this.pending && !this.pending.delivered) {
        this.deliver(next, this.pending);
      } else {
        this.waiting = next;
      }
    });
  }

  consume(): LiveStreamConsumer<T> {
    if (this.consumed) {
      throw new SerovalLiveStreamError('consumed');
    }
    this.consumed = true;
    return {
      read: () => this.read(),
      cancel: (reason) => this.cancel(reason),
    };
  }

  /**
   * Consumes the stream through a replay-style listener, accepting each
   * event as soon as it has been delivered. Use `consume` or `pump` when
   * acceptance must wait for processing.
   */
  on(listener: StreamListener<T>): () => void {
    const wrap =
      (key: keyof StreamListener<T>) =>
      (value: unknown, accept: () => void): void => {
        (listener[key] as (value: unknown) => void)(value);
        accept();
      };
    return this.pump({
      next: wrap('next'),
      throw: wrap('throw'),
      return: wrap('return'),
    });
  }

  /**
   * Consumes the stream into a sink that controls acceptance. Returns the
   * cancel function.
   * @internal
   */
  pump(sink: LiveStreamSink<T>): (reason?: unknown) => void {
    const consumer = this.consume();
    let current: LiveStreamSink<T> | undefined = sink;
    function next(): void {
      consumer.read().then(
        (delivery) => {
          const target = current;
          if (!target) {
            return;
          }
          const event = delivery.event;
          let failure: unknown;
          let failed = false;
          try {
            failure = (target[event.type] as (value: unknown, accept: () => void) => unknown)(
              event.type === 'throw' ? event.error : event.value,
              // oxlint-disable-next-line unbound-method -- accept is a closure and does not use this.
              delivery.accept,
            );
          } catch (error) {
            failed = true;
            failure = error;
          }
          if (failed || failure !== undefined) {
            current = undefined;
            try {
              consumer.cancel(failure);
            } finally {
              target.done?.();
            }
            return;
          }
          if (event.type === 'next') {
            next();
            return;
          }
          current = undefined;
          target.done?.();
        },
        (reason) => {
          const target = current;
          current = undefined;
          target?.error?.(reason);
        },
      );
    }
    next();
    // oxlint-disable-next-line unbound-method -- cancel is a closure and does not use this.
    return consumer.cancel;
  }
}

/**
 * Creates a live stream and the producer that writes to it.
 */
export function createLiveStream<T>(options?: LiveStreamOptions): {
  stream: LiveStream<T>;
  producer: LiveStreamProducer<T>;
} {
  const stream = new LiveStream<T>(options);
  return {
    stream,
    producer: {
      write(value) {
        return stream.push({ type: 'next', value });
      },
      close(value) {
        return stream.push({ type: 'return', value });
      },
      fail(error) {
        return stream.push({ type: 'throw', error });
      },
    },
  };
}
