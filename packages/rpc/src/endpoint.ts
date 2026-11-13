/* oxlint-disable typescript/promise-function-async, typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, typescript/unbound-method -- calls must start in order, so they return promises without async; generic channels need casts at the type boundary. */
import { createJSONReader, createJSONWriter } from '@seroval/transport';
import type { Message } from '@seroval/transport';
import {
  closeOwner,
  finishOwner,
  getOwnerCore,
  rejectHandled,
  startCall,
  stopOwner,
  wrapBackend,
} from './channel';
import type { OwnerCore } from './channel';
import { createChannelPlugin } from './channels/plugin';
import { createGeneratorPlugin } from './generators/plugin';
import { createCreditGate, isStreamItem, resolveWindow } from './streaming/gate';
import { watchStreams } from './streaming/watch';
import { createRpcSignal } from './signal';
import type { RpcSignalController } from './signal';
import { RpcClosedError, RpcRemoteError, RpcTransportError } from './errors';
import type { Channel, Endpoint, EndpointOptions, Functions, RpcSignal } from './types';

/**
 * A runtime-neutral port: the only thing the core knows about the connection.
 * `@seroval/rpc/post-message` and `@seroval/rpc/node` adapt real ports.
 */
export interface Port {
  /** Sends one message. It may throw when the port is closed. */
  send(message: unknown): void;
  /** Listens for messages, and returns a function that stops listening. */
  onMessage(listener: (message: unknown) => void): () => void;
  /** Listens for a failure of the connection. */
  onError?(listener: (error: unknown) => void): () => void;
  /** Listens for the other end closing the connection. */
  onClose?(listener: () => void): () => void;
  /** Closes the connection. */
  close?(): void;
}

/** The version in hello. A different version fails the endpoint. */
export const PROTOCOL_VERSION = 1;

// Transport messages go to the reader unchanged.
const DATA = 0;
const DONE = 1;
const FAIL = 2;
// rpc control messages.
const HELLO = 3;
const CREDIT = 4;
const CANCEL = 5;
const CLOSE = 6;
const CANCEL_CALL = 7;

interface Holder {
  /** The public channel of the receiver. */
  channel?: Channel<Functions>;
  /** Undefined until hello arrives, for the root. */
  id: number | undefined;
  isClosed: boolean;
  resolveClosed(): void;
}

interface PendingCall {
  holder: Holder;
  /** Stops listening to the caller's signal. */
  off?: () => void;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
}

/** A call that runs here for the other end. */
interface RunningCall {
  controller: RpcSignalController;
  /** The caller cancelled it, so there is no reply to send. */
  cancelled: boolean;
}

interface PushResult {
  key: string;
  failed: boolean;
  error: unknown;
}

/** What the tests can look at to check that nothing grows. */
export interface EndpointSizes {
  pending: number;
  owned: number;
  remote: number;
  held: number;
  readerKeys: number;
}

/** What the tests can look at to check that streaming leaves nothing. */
export interface StreamingSizes {
  /** Incoming calls that have not finished. */
  running: number;
  /** Keys that hold credit state. */
  windowKeys: number;
}

const streamInspectors = new WeakMap<Endpoint, () => StreamingSizes>();

/** Returns how much streaming state an endpoint holds. */
export function inspectStreaming(endpoint: Endpoint): StreamingSizes {
  const inspect = streamInspectors.get(endpoint);
  if (!inspect) {
    throw new TypeError('Not an endpoint.');
  }
  return inspect();
}

const inspectors = new WeakMap<Endpoint, () => EndpointSizes>();

/** Returns how much state an endpoint holds. */
export function inspectEndpoint(endpoint: Endpoint): EndpointSizes {
  const inspect = inspectors.get(endpoint);
  if (!inspect) {
    throw new TypeError('Not an endpoint.');
  }
  return inspect();
}

function ignoreRejection(): void {}

/** Reports an error that has no caller, as an unhandled rejection. */
function reportError(error: unknown): void {
  // oxlint-disable-next-line typescript/no-floating-promises, typescript/prefer-promise-reject-errors -- an unhandled rejection with the error as it is, is the report.
  Promise.reject(error);
}

/**
 * Whether a decoded value has a callable `then` and is not a native promise.
 * Resolving a promise with it would call that `then`, a function the other
 * end chose.
 */
function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    !(value instanceof Promise) &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function isCanonicalKey(key: unknown): key is string {
  if (typeof key !== 'string') {
    return false;
  }
  const id = Number(key);
  return Number.isSafeInteger(id) && id >= 0 && String(id) === key;
}

function describeMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

/** The only parts of an error that cross: `name` and `message`. */
function describeError(error: unknown): { name: string; message: string } {
  let name = 'Error';
  if (typeof error === 'object' && error !== null && 'name' in error) {
    name = String(error.name);
  }
  return { name, message: describeMessage(error) };
}

/** Rebuilds the error that a failed result describes. */
function createRemoteError(description: unknown): Error {
  let name = 'Error';
  let message = 'The call failed.';
  if (typeof description === 'object' && description !== null) {
    const fields = description as { name?: unknown; message?: unknown };
    if (typeof fields.name === 'string') {
      name = fields.name;
    }
    if (typeof fields.message === 'string') {
      message = fields.message;
    }
  }
  if (name === 'RpcClosedError') {
    return new RpcClosedError(message);
  }
  return new RpcRemoteError(name, message);
}

/** Ties a channel table and the transport to one port. */
export function createEndpoint(port: Port, options: EndpointOptions = {}): Endpoint {
  // Channels this side made and sent, and channels the other side sent.
  const owned = new Map<number, OwnerCore>();
  const remote = new Map<number, Holder>();
  // Calls that wait for a result, by the key the call went out under.
  const pending = new Map<string, PendingCall>();
  // Calls that run here, by the key they arrived under.
  const running = new Map<string, RunningCall>();
  const window = resolveWindow(options.window);
  const gate = createCreditGate();
  // Sends that wait for hello, and incoming calls that wait for serve.
  let held: (() => void)[] = [];
  let waiting: (() => void)[] = [];
  let rootCore: OwnerCore | undefined;
  let rootHolder: Channel<Functions> | undefined;
  let rootHolderState: Holder | undefined;
  let rootId: number | undefined;
  let served = false;
  // Whether the endpoint stopped, and whether the port may still be written.
  let closed = false;
  let live = true;
  // Why the endpoint stopped, for the calls that still start after.
  let stopReason: unknown;
  // The key of the next value that the other side opens.
  let nextKey = 0;
  let pushing: { key?: string; error?: unknown } | undefined;

  function sendMessage(message: unknown): void {
    if (!live) {
      return;
    }
    try {
      port.send(message);
    } catch (error) {
      fail(new RpcTransportError(describeMessage(error)));
    }
  }

  /** Sends a transport message and holds the source back past the window. */
  function sendTransport(message: Message): Promise<void> | undefined {
    sendMessage(message);
    if (message[0] === 0) {
      return isStreamItem(message) ? gate.sent(message[1]) : undefined;
    }
    // The value ended or failed, so nothing waits for credit anymore.
    gate.end(message[1]);
    return undefined;
  }

  // The plugin writes a channel as its ID, and resolves an ID to a receiver.
  const plugins = [
    createChannelPlugin({
      isChannel: (value) => getOwnerCore(value) !== undefined,
      sendChannel: registerChannel,
      receiveChannel: resolveChannel,
    }),
    // A native generator goes out as a hidden channel, ahead of seroval's one-way stream.
    createGeneratorPlugin({ sendChannel: registerChannel, receiveChannel: resolveChannel }),
    ...(options.plugins ?? []),
  ];
  const writer = createJSONWriter({
    plugins,
    send: sendTransport,
    onError(error, key) {
      // Only a value that fails while it is pushed is told to the caller.
      if (pushing) {
        pushing.key = key;
        pushing.error = error;
      }
    },
  });
  const reader = createJSONReader({ plugins });

  /** Sends a value under the writer's next key. */
  function pushValue(value: unknown): PushResult {
    const previous = pushing;
    const state: { key?: string; error?: unknown } = {};
    pushing = state;
    let key: string;
    try {
      key = writer.push(value);
    } finally {
      pushing = previous;
    }
    return { key, failed: state.key === key, error: state.error };
  }

  function sendResult(callKey: string, value: unknown, failed: boolean): void {
    if (closed) {
      return;
    }
    const result = pushValue(failed ? [callKey, value, 1] : [callKey, value]);
    // A result that cannot be sent is reported to the caller as an error.
    if (result.failed && !failed) {
      pushValue([callKey, describeError(result.error), 1]);
    }
  }

  /** Puts a channel in a value under its ID, and returns the ID. */
  function registerChannel(value: unknown): number {
    const core = getOwnerCore(value);
    if (!core) {
      throw new TypeError('Only a channel made by createChannel can be sent.');
    }
    if (closed) {
      throw new RpcClosedError('The endpoint is closed.');
    }
    const existing = owned.get(core.id);
    // Another channel holds the ID, as when two copies of rpc are loaded.
    if (existing && existing !== core) {
      throw new RpcTransportError(`Another channel already goes out under ID ${core.id}.`);
    }
    if (core.isClosed) {
      throw new RpcClosedError('The channel is closed.');
    }
    if (!existing) {
      owned.set(core.id, core);
      watchOwned(core);
    }
    return core.id;
  }

  /** Returns the receiver for a channel ID, one receiver for each ID. */
  function resolveChannel(id: number): Channel<Functions> {
    const known = remote.get(id);
    if (known?.channel) {
      return known.channel;
    }
    const created = createHolder(id);
    remote.set(id, created.holder);
    return created.channel;
  }

  /** Tells the other end when a channel that went out closes here. */
  function watchOwned(core: OwnerCore): void {
    core.watchers.add(() => {
      if (owned.get(core.id) === core) {
        owned.delete(core.id);
        // Side 1: the owner closed, so the other end looks in `remote`.
        sendMessage([CLOSE, core.id, 1]);
      }
      // Closing the root closes the endpoint.
      if (core === rootCore) {
        shutdown(new RpcClosedError());
      }
    });
  }

  function closeHolder(holder: Holder, notifyPeer: boolean): void {
    if (holder.isClosed) {
      return;
    }
    holder.isClosed = true;
    // Fail the calls that wait on this channel.
    for (const [key, call] of pending) {
      if (call.holder === holder) {
        pending.delete(key);
        call.off?.();
        call.reject(new RpcClosedError());
      }
    }
    if (holder.id !== undefined) {
      remote.delete(holder.id);
      if (notifyPeer) {
        // Side 0: the holder closed, so the other end looks in `owned`.
        sendMessage([CLOSE, holder.id, 0]);
      }
    }
    holder.resolveClosed();
    // Closing the root closes the endpoint.
    if (holder === rootHolderState) {
      shutdown(new RpcClosedError());
    }
  }

  function createHolder(id: number | undefined): { holder: Holder; channel: Channel<Functions> } {
    let resolveClosed!: () => void;
    const closedPromise = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const holder: Holder = { id, isClosed: false, resolveClosed };
    const channel = wrapBackend<Functions>({
      call(name, args, notify, signal) {
        if (holder.isClosed || closed) {
          return rejectHandled(new RpcClosedError());
        }
        return new Promise((resolve, reject) => {
          function send(): void {
            sendCall(holder, name, args, notify, signal, resolve, reject);
          }
          // Hold the call until hello gives the channel its ID.
          if (holder.id === undefined) {
            held.push(send);
          } else {
            send();
          }
        });
      },
      close() {
        closeHolder(holder, true);
      },
      closed: closedPromise,
    });
    holder.channel = channel;
    return { holder, channel };
  }

  function sendCall(
    holder: Holder,
    name: string,
    args: unknown[],
    notify: boolean,
    signal: RpcSignal | undefined,
    resolve: (value: unknown) => void,
    reject: (reason: unknown) => void,
  ): void {
    if (closed || holder.isClosed) {
      reject(closed ? stopReason : new RpcClosedError());
      return;
    }
    // A call that was cancelled while it waited for hello never goes out.
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const call: unknown[] = [holder.id, name, args];
    if (notify) {
      call.push(1);
    }
    const result = pushValue(call);
    if (result.failed) {
      reject(new RpcTransportError(describeMessage(result.error)));
    } else if (notify) {
      resolve(undefined);
    } else {
      const entry: PendingCall = { holder, resolve, reject };
      pending.set(result.key, entry);
      // Cancelling tells the callee, and the reply is not waited for.
      entry.off = signal?.onAbort(() => {
        if (pending.get(result.key) === entry) {
          pending.delete(result.key);
          sendMessage([CANCEL_CALL, result.key]);
          // Stop the streams of the arguments too.
          try {
            writer.cancel(result.key);
          } catch (error) {
            reportError(error);
          }
          gate.end(result.key);
        }
      });
    }
  }

  function handleCall(
    key: string,
    id: number,
    name: string,
    args: unknown[],
    notify: boolean,
  ): void {
    const core = owned.get(id);
    if (!core) {
      // Calls that come before serve wait for it.
      if (!served) {
        waiting.push(() => {
          handleCall(key, id, name, args, notify);
        });
      } else if (!notify) {
        sendResult(key, describeError(new RpcClosedError()), true);
      }
      return;
    }
    // The caller may cancel a call that expects a reply.
    const entry: RunningCall = { controller: createRpcSignal(), cancelled: false };
    if (!notify) {
      running.set(key, entry);
    }
    function reply(value: unknown, failed: boolean): void {
      running.delete(key);
      // A cancelled call has no caller left to hear the reply.
      if (!notify && !entry.cancelled) {
        sendResult(key, value, failed);
      }
    }
    startCall(core, name, args, options.onCall, entry.controller).then(
      (value) => {
        reply(value, false);
      },
      (error: unknown) => {
        reply(describeError(error), true);
      },
    );
  }

  function handleResult(callKey: string, value: unknown, failed: boolean): void {
    const call = pending.get(callKey);
    if (!call) {
      // The call was cancelled or its channel closed.
      return;
    }
    pending.delete(callKey);
    call.off?.();
    if (failed) {
      call.reject(createRemoteError(value));
    } else {
      call.resolve(value);
    }
  }

  function handleValue(key: string, value: unknown): void {
    if (closed || !Array.isArray(value)) {
      return;
    }
    if (typeof value[0] === 'number') {
      // A call is [channelId, name, args] and a notify has a 1 after them.
      const id: number = value[0];
      const name: unknown = value[1];
      const args: unknown = value[2];
      const notify: unknown = value[3];
      if (typeof name !== 'string' || !Array.isArray(args)) {
        throw new RpcTransportError('The other end sent a malformed call.');
      }
      // Streams in the arguments give credit back and cancel through this key.
      watchValue(key, args);
      handleCall(key, id, name, args, notify === 1);
    } else if (typeof value[0] === 'string') {
      // A result is [callKey, value] and a failure has a 1 after them.
      const failed = value[2] === 1;
      if (failed) {
        handleResult(value[0], value[1], true);
      } else if (pending.has(value[0])) {
        if (isThenable(value[1])) {
          throw new RpcTransportError('The other end sent a result with a `then` function.');
        }
        watchValue(key, value[1]);
        handleResult(value[0], value[1], false);
      } else {
        // The call was cancelled, so stop the streams of the reply.
        abandonValue(key);
      }
    }
  }

  /** Gives credit back to the writer of `key` as its streams are consumed. */
  function watchValue(key: string, root: unknown): void {
    watchStreams(root, window, {
      credit(count) {
        sendMessage([CREDIT, key, count]);
      },
      cancel() {
        abandonValue(key);
      },
    });
  }

  /** Stops reading `key` and tells the writer to stop its source. */
  function abandonValue(key: string): void {
    reader.cancel(key);
    sendMessage([CANCEL, key]);
  }

  function receiveCredit(key: unknown, count: unknown): void {
    if (typeof key === 'string' && typeof count === 'number' && count > 0) {
      gate.credit(key, count);
    }
  }

  function receiveCancelCall(key: unknown): void {
    if (typeof key !== 'string') {
      return;
    }
    // The caller cancelled a call that runs here: stop its argument streams.
    reader.cancel(key);
    const entry = running.get(key);
    if (entry && !entry.cancelled) {
      entry.cancelled = true;
      try {
        entry.controller.abort(new RpcClosedError('The caller cancelled the call.'));
      } catch (error) {
        reportError(error);
      }
    }
  }

  function receiveCancel(key: unknown): void {
    if (typeof key !== 'string') {
      return;
    }
    // The reader left a value this side writes, so stop its source.
    try {
      writer.cancel(key);
    } catch (error) {
      reportError(error);
    }
    gate.end(key);
  }

  function readValue(key: string): void {
    // Ask for both promises, so the reader frees the key once it settles.
    const value = reader.get(key);
    reader.settled(key).catch(ignoreRejection);
    value.then((data) => {
      try {
        handleValue(key, data);
      } catch (error) {
        fail(error);
      }
    }, ignoreRejection);
  }

  function receiveTransport(message: unknown[]): void {
    const key = message[1];
    if (!isCanonicalKey(key)) {
      fail(new RpcTransportError('The other end sent a malformed message.'));
      return;
    }
    // The other side opens its keys in order, so a key we have not seen is new.
    const id = Number(key);
    const isNew = id >= nextKey;
    if (isNew) {
      nextKey = id + 1;
    }
    try {
      reader.push(message);
    } catch (error) {
      fail(new RpcTransportError(describeMessage(error)));
      return;
    }
    if (isNew) {
      readValue(key);
    }
  }

  function receiveHello(version: unknown, id: unknown, peerWindow: unknown): void {
    if (version !== PROTOCOL_VERSION) {
      fail(new RpcTransportError(`The other end speaks protocol ${String(version)}.`));
      return;
    }
    if (
      typeof peerWindow !== 'number' ||
      !Number.isSafeInteger(peerWindow) ||
      peerWindow < 1 ||
      (id !== null && (typeof id !== 'number' || rootId !== undefined))
    ) {
      fail(new RpcTransportError('The other end sent a malformed hello.'));
      return;
    }
    // Write streams with the window that the other end reads with.
    gate.setWindow(peerWindow);
    if (id === null) {
      return;
    }
    rootId = id;
    if (rootHolderState) {
      rootHolderState.id = id;
      remote.set(id, rootHolderState);
    }
    // Calls made before hello now go out, in the order they were made.
    const calls = held;
    held = [];
    for (const send of calls) {
      send();
    }
  }

  function receiveClose(id: unknown, side: unknown): void {
    if (typeof id !== 'number') {
      return;
    }
    if (side === 0) {
      // The holder closed its end, so the channel is one this side owns.
      const core = owned.get(id);
      if (core) {
        // Forget the channel first, so closing it does not echo the message.
        owned.delete(id);
        closeOwner(core).catch(ignoreRejection);
      }
    } else if (side === 1) {
      // The owner closed the channel, so it is one this side holds.
      const holder = remote.get(id);
      if (holder) {
        closeHolder(holder, false);
      }
    }
  }

  function receive(message: unknown): void {
    if (closed) {
      return;
    }
    if (!Array.isArray(message)) {
      fail(new RpcTransportError('The other end sent a malformed message.'));
      return;
    }
    switch (message[0]) {
      case DATA:
      case DONE:
      case FAIL:
        receiveTransport(message);
        break;
      case HELLO:
        receiveHello(message[1], message[2], message[3]);
        break;
      case CLOSE:
        receiveClose(message[1], message[2]);
        break;
      case CREDIT:
        receiveCredit(message[1], message[2]);
        break;
      case CANCEL:
        receiveCancel(message[1]);
        break;
      case CANCEL_CALL:
        receiveCancelCall(message[1]);
        break;
      default:
        fail(new RpcTransportError('The other end sent an unknown message.'));
    }
  }

  const stops: (() => void)[] = [port.onMessage(receive)];
  if (port.onError) {
    stops.push(
      port.onError((error) => {
        fail(new RpcTransportError(describeMessage(error)));
      }),
    );
  }
  if (port.onClose) {
    stops.push(
      port.onClose(() => {
        live = false;
        shutdown(new RpcClosedError('The connection closed.'));
      }),
    );
  }

  function fail(error: unknown): void {
    live = false;
    shutdown(error);
  }

  function shutdown(error: unknown): void {
    if (closed) {
      return;
    }
    closed = true;
    stopReason = error;
    // Fail the calls in flight.
    for (const call of pending.values()) {
      call.off?.();
      call.reject(error);
    }
    pending.clear();
    // The calls that still run lose their caller.
    for (const entry of running.values()) {
      entry.cancelled = true;
      try {
        entry.controller.abort(new RpcClosedError());
      } catch (caught) {
        reportError(caught);
      }
    }
    running.clear();
    // Run the sends that still wait for hello; each one fails as closed.
    const calls = held;
    held = [];
    for (const send of calls) {
      send();
    }
    waiting = [];
    // Close the channels, which tells the other end while the port is open.
    for (const holder of remote.values()) {
      closeHolder(holder, true);
    }
    if (rootHolderState) {
      closeHolder(rootHolderState, true);
    }
    // Nested channels first, in the reverse order they went out, the root last.
    const cores: OwnerCore[] = [];
    for (const core of owned.values()) {
      if (core !== rootCore) {
        cores.unshift(core);
      }
    }
    if (rootCore) {
      cores.push(rootCore);
    }
    owned.clear();
    const stopped: OwnerCore[] = [];
    const skipped: OwnerCore[] = [];
    for (const core of cores) {
      if (stopOwner(core)) {
        stopped.push(core);
      } else {
        skipped.push(core);
      }
    }
    // Stop the transport.
    try {
      writer.close(error);
    } catch {}
    gate.clear();
    try {
      reader.end(error);
    } catch {}
    live = false;
    for (const stop of stops) {
      stop();
    }
    // Run onClose one channel at a time, after the streams are stopped.
    let previous: Promise<void> = Promise.resolve();
    for (const core of stopped) {
      core.finishAfter = previous;
      previous = finishOwner(core);
    }
    // A channel whose close began this shutdown finishes after the others.
    for (const core of skipped) {
      core.finishAfter = previous;
    }
    try {
      port.close?.();
    } catch {}
  }

  // Tell the other end the window this side reads with, before any root.
  sendMessage([HELLO, PROTOCOL_VERSION, null, window]);

  const endpoint: Endpoint = {
    serve(root) {
      const core = getOwnerCore(root);
      if (!core) {
        throw new TypeError('serve needs a channel made by createChannel.');
      }
      if (served) {
        throw new RpcTransportError('The endpoint already serves a channel.');
      }
      if (closed) {
        throw new RpcClosedError('The endpoint is closed.');
      }
      served = true;
      rootCore = core;
      if (owned.get(core.id) !== core) {
        owned.set(core.id, core);
        watchOwned(core);
      }
      sendMessage([HELLO, PROTOCOL_VERSION, core.id, window]);
      // Calls that came before serve can run now.
      const calls = waiting;
      waiting = [];
      for (const run of calls) {
        run();
      }
    },
    connect<T extends Functions<T>>() {
      if (!rootHolder) {
        const created = createHolder(rootId);
        rootHolder = created.channel;
        rootHolderState = created.holder;
        if (rootId !== undefined) {
          remote.set(rootId, created.holder);
        }
        if (closed) {
          closeHolder(created.holder, false);
        }
      }
      return rootHolder as unknown as Channel<T>;
    },
    close() {
      shutdown(new RpcClosedError());
    },
  };
  inspectors.set(endpoint, () => ({
    pending: pending.size,
    owned: owned.size,
    remote: remote.size,
    held: held.length + waiting.length,
    readerKeys: reader.size,
  }));
  streamInspectors.set(endpoint, () => ({ running: running.size, windowKeys: gate.size }));
  return endpoint;
}
