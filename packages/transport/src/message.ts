/**
 * A message of a transport session. Each one names the key of the value it
 * belongs to, so many values can share one connection.
 *
 * - `[0, key, data]` carries the next piece of a value. The first one for a
 *   key starts the value. `data` is a `SerovalNode` in JSON mode, and code in
 *   JS mode.
 * - `[1, key]` says the value and everything in it settled.
 * - `[2, key]` says the writer failed or cancelled the value.
 */
export type Message<T = unknown> =
  | [type: typeof DATA, key: string, data: T]
  | [type: typeof DONE, key: string]
  | [type: typeof FAIL, key: string];

export const DATA = 0;
export const DONE = 1;
export const FAIL = 2;

export class SerovalTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerovalTransportError';
  }
}

/** Throws when `message` is not a message, such as one from a broken peer. */
export function assertMessage(message: unknown): asserts message is Message {
  if (
    !Array.isArray(message) ||
    typeof message[1] !== 'string' ||
    !(message[0] === DATA
      ? message.length === 3
      : (message[0] === DONE || message[0] === FAIL) && message.length === 2)
  ) {
    throw new SerovalTransportError('The transport received a malformed message.');
  }
}
