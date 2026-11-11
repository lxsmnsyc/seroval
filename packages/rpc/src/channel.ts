/* oxlint-disable typescript/promise-function-async, typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, typescript/unbound-method -- calls must start in order, so they return promises without async; generic channels need casts at the type boundary. */
import { RpcClosedError } from './errors';
import { createRpcSignal } from './signal';
import type { RpcSignalController } from './signal';
import type {
  CallContext,
  Caller,
  Channel,
  ChannelOptions,
  Functions,
  IncomingCall,
  RpcSignal,
} from './types';

/** What a channel does when it is called or closed. */
export interface ChannelBackend {
  call(
    name: string,
    args: unknown[],
    notify: boolean,
    signal: RpcSignal | undefined,
  ): Promise<unknown>;
  close(): void;
  readonly closed: Promise<void>;
}

/** The state of a channel that this side owns. */
export interface OwnerCore {
  readonly id: number;
  readonly functions: Functions;
  readonly options: ChannelOptions;
  /** Set right after the channel is made. */
  channel: Channel<Functions>;
  isClosed: boolean;
  /** One controller for each call that is running. */
  readonly calls: Set<RpcSignalController>;
  /** Run when the channel closes, before `onClose`. */
  readonly watchers: Set<() => void>;
  /** Resolves `channel.closed`. */
  resolveClosed(): void;
}

type Middleware = (call: IncomingCall, next: () => Promise<unknown>) => Promise<unknown>;

const cores = new WeakMap<object, OwnerCore>();
const hasOwn = Object.prototype.hasOwnProperty;
let nextId = 1;

function ignoreRejection(): void {}

/** A rejected promise that nobody has to handle. */
export function rejectHandled(reason: unknown): Promise<never> {
  // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- the reason is the caller's.
  const promise = Promise.reject(reason);
  promise.catch(ignoreRejection);
  return promise;
}

/** Makes the public channel of a backend. */
export function wrapBackend<T extends Functions<T>>(backend: ChannelBackend): Channel<T> {
  function call(
    name: string,
    args: unknown[],
    notify: boolean,
    signal: RpcSignal | undefined,
  ): Promise<unknown> {
    if (!signal) {
      return backend.call(name, args, notify, undefined);
    }
    // A signal that aborted already stops the call before it starts.
    if (signal.aborted) {
      return rejectHandled(signal.reason);
    }
    return new Promise((resolve, reject) => {
      const off = signal.onAbort(reject);
      backend.call(name, args, notify, signal).then(resolve, reject).finally(off);
    });
  }

  function createCaller(signal: RpcSignal | undefined): Caller<T> {
    return {
      run: ((name: string, ...args: unknown[]) =>
        call(name, args, false, signal)) as Caller<T>['run'],
      notify(name: string, ...args: unknown[]) {
        // A notify gets no result, so its failure is dropped.
        call(name, args, true, signal).catch(ignoreRejection);
      },
    };
  }

  const caller = createCaller(undefined);
  return {
    run: caller.run,
    notify: caller.notify,
    with: (options) => createCaller(options.signal),
    close: () => {
      backend.close();
    },
    closed: backend.closed,
  };
}

/** Makes a channel that owns `functions`. */
export function createChannel<T extends Functions<T>>(
  functions: T,
  options: ChannelOptions = {},
): Channel<T> {
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const core: OwnerCore = {
    id: nextId++,
    functions,
    options,
    // Replaced right after the channel is made.
    channel: undefined as never,
    isClosed: false,
    calls: new Set(),
    watchers: new Set(),
    resolveClosed,
  };
  const channel = wrapBackend<T>({
    call(name, args) {
      if (core.isClosed) {
        return rejectHandled(new RpcClosedError());
      }
      // A call on a local channel runs in place, in the order it was made.
      return startCall(core, name, args);
    },
    close() {
      closeOwner(core).catch(ignoreRejection);
    },
    closed,
  });
  core.channel = channel as unknown as Channel<Functions>;
  cores.set(channel, core);
  return channel;
}

/** Returns the state of a channel made by `createChannel`. */
export function getOwnerCore(channel: unknown): OwnerCore | undefined {
  if (typeof channel === 'object' && channel !== null) {
    return cores.get(channel);
  }
  return undefined;
}

function callFunction(
  core: OwnerCore,
  name: string,
  args: unknown[],
  context: CallContext,
): Promise<unknown> {
  // Run the function when the promise is made, so calls start in order.
  return new Promise((resolve) => {
    if (!hasOwn.call(core.functions, name)) {
      throw new TypeError(`The channel has no function "${name}".`);
    }
    const target = core.functions[name];
    if (typeof target !== 'function') {
      throw new TypeError(`"${name}" is not a function.`);
    }
    resolve((target as (...values: unknown[]) => unknown).apply(context, args));
  });
}

/** Runs one call on a channel this side owns. */
export function startCall(
  core: OwnerCore,
  name: string,
  args: unknown[],
  middleware?: Middleware,
  controller: RpcSignalController = createRpcSignal(),
): Promise<unknown> {
  core.calls.add(controller);
  const context: CallContext = { signal: controller.signal, channel: core.channel };
  function next(): Promise<unknown> {
    return callFunction(core, name, args, context);
  }
  const result = middleware
    ? new Promise<unknown>((resolve) => {
        resolve(middleware({ name, args, context }, next));
      })
    : next();
  return result.finally(() => {
    core.calls.delete(controller);
  });
}

/** Closes a channel this side owns. Closing it twice does nothing. */
export async function closeOwner(core: OwnerCore): Promise<void> {
  if (core.isClosed) {
    return;
  }
  core.isClosed = true;
  // Stop the calls that still run.
  const reason = new RpcClosedError();
  for (const controller of core.calls) {
    try {
      controller.abort(reason);
    } catch (error) {
      reportError(error);
    }
  }
  core.calls.clear();
  // Tell the endpoint, which tells the other side.
  for (const watcher of core.watchers) {
    watcher();
  }
  core.watchers.clear();
  // A throwing onClose is reported, not rethrown.
  try {
    await core.options.onClose?.();
  } catch (error) {
    reportError(error);
  }
  core.resolveClosed();
}

/** Reports an error that has no caller, as an unhandled rejection. */
function reportError(error: unknown): void {
  // oxlint-disable-next-line typescript/no-floating-promises, typescript/prefer-promise-reject-errors -- an unhandled rejection with the error as it is, is the report.
  Promise.reject(error);
}
