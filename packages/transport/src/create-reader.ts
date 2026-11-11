import { DATA, DONE, SerovalTransportError, assertMessage } from './message';

export interface Reader {
  /**
   * Takes the next message from the writer. Throws on a malformed message,
   * or on a key past `maxKeys`; end the reader with that error then, since
   * the writer cannot be trusted anymore.
   */
  push(message: unknown): void;
  /**
   * Resolves with the value of `key` once its first message arrives. Later
   * messages settle the promises and streams in it. Keep the promise: once
   * the key is freed, a later call waits for a new value under it.
   */
  get<T>(key: string): Promise<T>;
  /**
   * Resolves once the value of `key` and every promise and stream in it
   * settled. Rejects when the value fails, is cancelled, or the reader ends
   * first.
   */
  settled(key: string): Promise<void>;
  /**
   * Stops reading `key`: fails what still waits in it, forgets it, and drops
   * its later messages. Tell the writer to `cancel` it too, if it can hear.
   * A key the reader no longer holds, such as one that settled after both
   * `get` and `settled` were called, is left alone.
   */
  cancel(key: string, reason?: unknown): void;
  /**
   * How many keys the reader holds. A key is freed once it settled and both
   * `get` and `settled` were called for it, or when it is cancelled.
   */
  readonly size: number;
  /**
   * Stops reading. Every value that has not arrived, and every promise and
   * stream that still waits, fails with `reason`, or with a
   * `SerovalTransportError` when there is none.
   */
  end(reason?: unknown): void;
}

/** A reader of a single value, from `fromJSONStream` or `fromJSStream`. */
export interface ValueReader<T> extends Pick<Reader, 'push' | 'end'> {
  value: Promise<T>;
  /** Resolves once the value and every promise and stream in it settled. */
  settled: Promise<void>;
}

export interface ReaderOptions {
  /**
   * The most keys the writer can send that `get` and `settled` were not
   * called for. The reader keeps these values until they are requested, so
   * a writer that sends more fails with a `SerovalTransportError`.
   * Defaults to 1000.
   */
  maxKeys?: number;
}

/** The default `maxKeys`. */
const DEFAULT_MAX_KEYS = 1000;

/** How a reader turns the data of each key into values. */
export interface Decoder {
  /** Decodes the first data of `key`, and returns its value. */
  open(key: string, data: unknown): unknown;
  /** Decodes later data of `key`. */
  next(key: string, data: unknown): void;
  /**
   * Frees `key` after the writer settled it. A decoder that still decodes
   * returns a promise, and `settled` waits for it.
   */
  done(key: string): void | Promise<void>;
  /** Fails what still waits in `key`, and frees it. */
  fail(key: string, reason: unknown): void;
  /** Fails what still waits in every key. */
  end(reason: unknown): void;
}

const WAITING = 0;
const OPEN = 1;
const SETTLED = 2;

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

interface Slot {
  state: typeof WAITING | typeof OPEN | typeof SETTLED;
  value: Deferred<unknown>;
  settled: Deferred<void>;
  // Whether `get` and `settled` were called. Once both were and the key
  // settled, the caller holds both promises and the slot can be freed.
  gotValue: boolean;
  gotSettled: boolean;
  // Set while the decoder still decodes a value that the writer settled. The
  // slot is kept until it is done, so `cancel` and `end` can still stop it.
  decoding: boolean;
}

// A value that nobody reads can fail, and must not cause an unhandled
// rejection. Code that awaits it still gets the rejection.
export const ignoreRejection = (): void => {};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(ignoreRejection);
  return { promise, resolve, reject };
}

function createSlot(): Slot {
  return {
    state: WAITING,
    value: createDeferred(),
    settled: createDeferred(),
    gotValue: false,
    gotSettled: false,
    decoding: false,
  };
}

/** True when nobody called `get` or `settled` for the slot yet. */
function isUnrequested(slot: Slot): boolean {
  return !slot.gotValue && !slot.gotSettled;
}

/** Fails a slot that has not settled. A slot that is open has its value. */
function failSlot(slot: Slot, reason: unknown): void {
  if (slot.state === WAITING) {
    slot.value.reject(reason);
  }
  slot.state = SETTLED;
  slot.settled.reject(reason);
}

export function createEndError(): SerovalTransportError {
  return new SerovalTransportError('The stream ended before every value settled.');
}

function createMissingError(key: string): SerovalTransportError {
  return new SerovalTransportError(`The stream ended before "${key}" arrived.`);
}

function createFailError(key: string): SerovalTransportError {
  return new SerovalTransportError(`The writer failed or cancelled "${key}".`);
}

function createUnexpectedError(key: string): SerovalTransportError {
  return new SerovalTransportError(`The transport received a message for "${key}" after it ended.`);
}

export function createReader(decoder: Decoder, options: ReaderOptions): Reader {
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const slots = new Map<string, Slot>();
  // Keys that the reader cancelled before the writer ended them. Their later
  // messages are dropped.
  const cancelled = new Set<string>();
  // How many slots the writer opened that nobody requested yet.
  let unrequested = 0;
  let ended = false;
  let endReason: unknown;

  /** Returns the slot of `key` for a message, and counts a new one. */
  function getSlot(key: string): Slot {
    let slot = slots.get(key);
    if (!slot) {
      // Only the app can free these, so a writer cannot open them freely.
      if (unrequested >= maxKeys) {
        throw new SerovalTransportError(
          `The writer sent more than ${maxKeys} values that were not requested.`,
        );
      }
      slot = createSlot();
      slots.set(key, slot);
      unrequested++;
    }
    return slot;
  }

  /** Forgets `key`. */
  function removeSlot(key: string, slot: Slot): void {
    slots.delete(key);
    if (isUnrequested(slot)) {
      unrequested--;
    }
  }

  /** Frees a slot that settled once the caller holds both of its promises. */
  function releaseSlot(key: string, slot: Slot): void {
    if (slot.state === SETTLED && !slot.decoding && slot.gotValue && slot.gotSettled) {
      removeSlot(key, slot);
    }
  }

  /** Returns the slot of `key` for `get` and `settled`, which never open it. */
  function requestSlot(key: string): Slot {
    let slot = slots.get(key);
    if (slot) {
      if (isUnrequested(slot)) {
        unrequested--;
      }
    } else {
      slot = createSlot();
      slots.set(key, slot);
      if (ended) {
        failSlot(slot, endReason ?? createMissingError(key));
      }
    }
    return slot;
  }

  function onData(key: string, data: unknown): void {
    const slot = getSlot(key);
    if (slot.state === WAITING) {
      // Open before the state changes, so a value that fails to decode stays
      // waiting and fails when the reader ends.
      const value = decoder.open(key, data);
      slot.state = OPEN;
      slot.value.resolve(value);
    } else if (slot.state === OPEN) {
      decoder.next(key, data);
    } else {
      throw createUnexpectedError(key);
    }
  }

  /** Settles a slot once its decoder is done, and frees it if it can. */
  function finishDecoding(key: string, slot: Slot, failure: { error: unknown } | undefined): void {
    slot.decoding = false;
    if (failure) {
      slot.settled.reject(failure.error);
    } else {
      slot.settled.resolve();
    }
    // `cancel` may have removed the slot already.
    if (slots.get(key) === slot) {
      releaseSlot(key, slot);
    }
  }

  function onEnd(key: string, done: boolean): void {
    const slot = getSlot(key);
    if (slot.state === SETTLED || (done && slot.state === WAITING)) {
      throw createUnexpectedError(key);
    }
    if (done) {
      slot.state = SETTLED;
      // A decoder that throws while it frees the key still settles it.
      let decoded: void | Promise<void> = undefined;
      try {
        decoded = decoder.done(key);
      } finally {
        if (decoded) {
          slot.decoding = true;
          decoded.then(
            () => finishDecoding(key, slot, undefined),
            (error: unknown) => finishDecoding(key, slot, { error }),
          );
        } else {
          slot.settled.resolve();
          releaseSlot(key, slot);
        }
      }
      return;
    }
    const state = slot.state;
    const reason = createFailError(key);
    failSlot(slot, reason);
    releaseSlot(key, slot);
    if (state === OPEN) {
      decoder.fail(key, reason);
    }
  }

  return {
    push(message) {
      if (ended) {
        return;
      }
      assertMessage(message);
      const key = message[1];
      if (cancelled.has(key)) {
        if (message[0] !== DATA) {
          cancelled.delete(key);
        }
        return;
      }
      if (message[0] === DATA) {
        onData(key, message[2]);
      } else {
        onEnd(key, message[0] === DONE);
      }
    },
    get<T>(key: string): Promise<T> {
      const slot = requestSlot(key);
      slot.gotValue = true;
      releaseSlot(key, slot);
      return slot.value.promise as Promise<T>;
    },
    settled(key) {
      const slot = requestSlot(key);
      slot.gotSettled = true;
      releaseSlot(key, slot);
      return slot.settled.promise;
    },
    cancel(key, reason = new SerovalTransportError(`"${key}" was cancelled.`)) {
      // A key the reader does not hold has nothing to fail. Remembering it
      // would keep every key that is cancelled after it was freed.
      const slot = slots.get(key);
      if (!slot) {
        return;
      }
      removeSlot(key, slot);
      if (ended) {
        return;
      }
      // The writer settled it, but the decoder still decodes it. The writer
      // sends nothing more, so there are no messages to drop.
      if (slot.decoding) {
        failSlot(slot, reason);
        decoder.fail(key, reason);
        return;
      }
      if (slot.state === SETTLED) {
        return;
      }
      cancelled.add(key);
      const state = slot.state;
      failSlot(slot, reason);
      if (state === OPEN) {
        decoder.fail(key, reason);
      }
    },
    get size() {
      return slots.size + cancelled.size;
    },
    end(reason) {
      if (ended) {
        return;
      }
      ended = true;
      endReason = reason;
      cancelled.clear();
      for (const [key, slot] of slots) {
        if (slot.state !== SETTLED) {
          failSlot(
            slot,
            reason ?? (slot.state === WAITING ? createMissingError(key) : createEndError()),
          );
        }
      }
      decoder.end(reason ?? createEndError());
    },
  };
}

/** The key that `toJSONStream`, `toJSStream` and `toBinaryStream` send their value under. */
const VALUE_KEY = '0';

export function createValueReader<T>(reader: Reader): ValueReader<T> {
  return {
    value: reader.get<T>(VALUE_KEY),
    settled: reader.settled(VALUE_KEY),
    push: reader.push,
    end: reader.end,
  };
}
