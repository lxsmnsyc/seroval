---
name: rpc-api
version: 3
status: frozen
defined_by: rpc-docs
---

# Contract: rpc-api

## Purpose

The public API of `@seroval/rpc`. It stayed a draft through the chain and froze at rpc-docs, after the worker example ran on real code (debate P1, O5).

## Interface

The code is in `packages/rpc/src/types.ts`, `src/signal.ts`, `src/errors.ts`, `src/endpoint.ts`, `src/node.ts` and `src/post-message.ts`. The core uses no Web API.

```ts
// @seroval/rpc
type RemoteFunction = (this: CallContext, ...args: never[]) => unknown;
type Functions<T = Record<string, RemoteFunction>> = { [K in keyof T]: RemoteFunction };

interface RpcSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  onAbort(listener: (reason: unknown) => void): () => void;
}

interface RpcSignalController {
  readonly signal: RpcSignal;
  abort(reason?: unknown): void;
}

function createRpcSignal(): RpcSignalController;

interface CallContext {
  /** Aborts when the caller cancels, the channel closes or the endpoint closes. Valid across awaits. */
  readonly signal: RpcSignal;
  /** The channel the call came in on. */
  readonly channel: Channel<Functions>;
}

interface Caller<T extends Functions<T>> {
  run<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): Promise<Awaited<ReturnType<T[K]>>>;
  notify<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): void;
}

interface Channel<T extends Functions<T>> extends Caller<T> {
  with(options: { signal?: RpcSignal }): Caller<T>;
  close(): void;
  readonly closed: Promise<void>;
}

interface ChannelOptions {
  onClose?(): void | Promise<void>;
}

function createChannel<T extends Functions<T>>(functions: T, options?: ChannelOptions): Channel<T>;

interface IncomingCall {
  name: string;
  args: unknown[];
  context: CallContext;
}

interface EndpointOptions {
  plugins?: Plugin<any, any>[];
  onCall?(call: IncomingCall, next: () => Promise<unknown>): Promise<unknown>;
  /** Positive integer, default 16. */
  window?: number;
}

interface Port {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  onError?(listener: (error: unknown) => void): () => void;
  /** Fails calls in flight when the other side goes away. */
  onClose?(listener: () => void): () => void;
  close?(): void;
}

interface Endpoint {
  serve(root: Channel<Functions>): void;
  connect<T extends Functions<T>>(): Channel<T>;
  /** `reason` is accepted and ignored. */
  close(reason?: unknown): void;
}

function createEndpoint(port: Port, options?: EndpointOptions): Endpoint;

class RpcClosedError extends Error {
  constructor(message?: string);
}
class RpcTransportError extends Error {
  constructor(message?: string);
}
class RpcRemoteError extends Error {
  readonly remoteName: string;
  constructor(remoteName: string, message: string);
}

// @seroval/rpc/post-message
interface MessagePortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
  start?(): void;
  close?(): void;
}
function fromMessagePort(source: MessagePortLike): Port;

// @seroval/rpc/node
function fromNodeWorker(source: Worker | MessagePort): Port; // node:worker_threads types
```

`@seroval/rpc` exports the values `createChannel`, `createEndpoint`, `createRpcSignal`, `RpcClosedError`, `RpcTransportError` and `RpcRemoteError`, and every type above except `MessagePortLike`. It does not export `PROTOCOL_VERSION`, `inspectEndpoint` or `inspectStreaming`. There is no `transfer()`.

## Behavior

- Calls on one channel start on the callee in the order they were made.
- `run`, `notify`, `with` and `close` are channel methods, so functions may use those names.
- A call the owner makes on its own channel runs in place. It skips `onCall`, and `with({ signal })` rejects the caller without aborting the callee's `this.signal`.
- After a close, `run` rejects with `RpcClosedError` and handles its own rejection.
- A cancelled `run` rejects with the signal's `reason`. The callee's `this.signal` aborts with an `RpcClosedError`.
- `createEndpoint` throws a `RangeError` when `window` is not a positive integer.
- `serve` throws a `TypeError` for a value not made by `createChannel`, an `RpcTransportError` on a second call, and an `RpcClosedError` after the endpoint closed.
- `connect()` returns the same holder on every call. `T` is not checked against what the other side serves.
- `onCall` runs for every call that arrives on a channel this side owns, including the `next`, `throw` and `return` steps of a generator this side sent. What it returns or throws is the result.
- Closing the root channel from either end closes both endpoints.
- A transport failure closes the endpoint and rejects the calls in flight with that `RpcTransportError`. A port `onClose` rejects them with `RpcClosedError`.
- Close order: stop taking messages, fail calls in flight and abort running calls, close held channels, stop owned channels (nested in reverse send order, root last), stop sent streams, fail read streams, then run `onClose` one channel at a time in the same order and call `port.close()`. A throwing `onClose` is reported as an unhandled rejection and the rest run.
- A remote error crosses as `name` and `message` only. A name of `RpcClosedError` is rebuilt as `RpcClosedError`, any other as `RpcRemoteError(name, message)`. An error out of a received stream becomes `RpcRemoteError` unless it is already an rpc error. A `SerovalTransportError` from transport becomes `RpcTransportError`.
- A real `AbortSignal` is the user's to convert to an `RpcSignal`. An `AbortSignal` inside a value needs `AbortSignalPlugin`; rpc gives it no special handling.
- Every native generator and async generator in a value becomes a two-way `AsyncGenerator` on the other side, a sync one included. Each step is one round trip with no credit window. A plain async iterable (an object with `Symbol.asyncIterator`) is the one-way stream with the window. There is no `stream(generator)` marker.
- A received generator can be sent on. The receiver closes the hidden channel once a step is done or fails.

## Changes

- v1: draft, rewritten after the debate: built on `@seroval/transport`, no `rpc-internals` extension contract, no garbage-collection close.
- v2: `RpcSignal` replaces `AbortSignal`; `Functions<T>` is a mapped type so interfaces fit; `CallContext.channel`; a runtime-neutral port, with `transfer` and the postMessage adapter in `@seroval/rpc/post-message` and `fromNodeWorker` in `@seroval/rpc/node` (rpc-spike change request, accepted 2026-11-11).
- v2 (rpc-endpoint, 2026-11-11): `Port.onClose`; `initiator` removed, since keys come from transport; `transfer` left out.
- v3 (rpc-docs, 2026-11-12, frozen): matched to the code. The differences are listed in `nodes/rpc-docs/outcome.md` under Contract differences.
