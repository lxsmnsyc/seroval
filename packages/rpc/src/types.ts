import type { Plugin } from 'seroval';

/**
 * A cancel signal that needs no Web API. rpc makes the one a called function
 * sees, and `with` accepts any object of this shape.
 */
export interface RpcSignal {
  readonly aborted: boolean;
  /** Why it aborted. `undefined` until then. */
  readonly reason: unknown;
  /**
   * Calls `listener` once with the reason when it aborts, or never if it does
   * not. Returns a function that removes the listener. A listener added after
   * the abort is not called; check `aborted` first.
   */
  onAbort(listener: (reason: unknown) => void): () => void;
}

/** What a function sees as `this` while it runs for a call. */
export interface CallContext {
  /** Aborts when the caller cancels or the endpoint closes. Valid across awaits. */
  readonly signal: RpcSignal;
  /** The channel this call came in on, for example to close it. */
  readonly channel: Channel<Functions>;
}

/** One function a channel exposes. */
export type RemoteFunction = (this: CallContext, ...args: never[]) => unknown;

/**
 * The functions a channel exposes, as a `type`, an `interface` or `typeof`
 * an object. A mapped type and not a `Record`, so an interface fits too.
 */
export type Functions<T = Record<string, RemoteFunction>> = { [K in keyof T]: RemoteFunction };

/** The part of a channel that makes calls. */
export interface Caller<T extends Functions<T>> {
  /** Calls `name` on the owner and resolves with its result. */
  run<K extends keyof T & string>(
    name: K,
    ...args: Parameters<T[K]>
  ): Promise<Awaited<ReturnType<T[K]>>>;
  /** Calls `name` and does not wait for a result or an error. */
  notify<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): void;
}

/**
 * One end of a channel. The owner made it with `createChannel`; the holder
 * got it from `connect()` or inside a value.
 */
export interface Channel<T extends Functions<T>> extends Caller<T> {
  /** Returns a caller whose calls cancel when `signal` aborts. */
  with(options: { signal?: RpcSignal }): Caller<T>;
  /** Closes the channel for the owner and every holder. */
  close(): void;
  /** Resolves once the channel closed, from either end. */
  readonly closed: Promise<void>;
}

export interface ChannelOptions {
  /** Runs once when the channel closes. A throw is reported, not rethrown. */
  onClose?(): void | Promise<void>;
}

/** What `onCall` sees: one incoming call. */
export interface IncomingCall {
  name: string;
  args: unknown[];
  context: CallContext;
}

export interface EndpointOptions {
  /** True on one side only. It picks even or odd call IDs. */
  initiator: boolean;
  plugins?: Plugin<any, any>[];
  /** Wraps every incoming call. Call `next` to run the function. */
  onCall?(call: IncomingCall, next: () => Promise<unknown>): Promise<unknown>;
  /** How many items of a stream the reader allows in flight. */
  window?: number;
}

/**
 * The part of a `MessagePort` that rpc uses. A `worker_threads` `Worker` has
 * `on` and not `addEventListener`; wrap it (see `test/support/node-port.ts`).
 */
export interface MessagePortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error' | 'messageerror', listener: (event: unknown) => void): void;
  close?(): void;
}

export interface Endpoint {
  /** Makes `root` the channel that the other side gets from `connect()`. */
  serve(root: Channel<Functions>): void;
  /** The root channel that the other side served. */
  connect<T extends Functions<T>>(): Channel<T>;
  /** Closes every channel and the transport. */
  close(reason?: unknown): void;
}
