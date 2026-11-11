---
name: rpc-api
version: 2
status: draft
defined_by: rpc-docs
---

# Contract: rpc-api

## Purpose

The public API of `@seroval/rpc`. It stays a draft through the chain and freezes at rpc-docs, after the worker example has run on real code (debate P1, O5).

## Interface

The spike wrote the draft to `packages/rpc/src/types.ts` and `src/signal.ts`. The core uses no Web API.

```ts
type RemoteFunction = (this: CallContext, ...args: never[]) => unknown;
type Functions<T = Record<string, RemoteFunction>> = { [K in keyof T]: RemoteFunction };

interface RpcSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  onAbort(listener: (reason: unknown) => void): () => void;
}

function createRpcSignal(): { readonly signal: RpcSignal; abort(reason?: unknown): void };

interface CallContext {
  /** Aborts when the caller cancels or the endpoint closes. Valid across awaits. */
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

function createChannel<T extends Functions<T>>(functions: T, options?: { onClose?(): void | Promise<void> }): Channel<T>;

interface EndpointOptions {
  plugins?: Plugin<any, any>[];
  onCall?(call: { name: string; args: unknown[]; context: CallContext }, next: () => Promise<unknown>): Promise<unknown>;
  window?: number;
}

// The runtime-neutral port (src/endpoint.ts).
interface Port {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  onError?(listener: (error: unknown) => void): () => void;
  /** Fails calls in flight when the other side goes away. */
  onClose?(listener: () => void): () => void;
  close?(): void;
}

function createEndpoint(port: Port, options: EndpointOptions): {
  serve(root: Channel<Functions>): void;
  connect<T extends Functions<T>>(): Channel<T>;
  close(reason?: unknown): void;
};

class RpcClosedError extends Error {}
class RpcTransportError extends Error {}
class RpcRemoteError extends Error {}

// @seroval/rpc/post-message: the postMessage port adapter (Worker, MessagePort, parentPort).
// @seroval/rpc/node: fromNodeWorker(worker). Its close() does not terminate the worker.
// transfer() is left out until a seroval plugin can move buffers.
```

## Behavior

- Calls on one channel start on the callee in the order they were made.
- `run`, `notify`, `with` and `close` are channel methods, so functions may use those names.
- After a close, `run` rejects with `RpcClosedError` and handles its own rejection.
- Close order: stop taking messages, close channels, stop sent streams, fail read streams, run `onClose` nested first and root last. A throwing `onClose` is reported and the rest run.
- A cancelled `run` rejects with the signal's `reason`.
- A real `AbortSignal` is the user's to convert to an `RpcSignal`. An `AbortSignal` inside a value needs `AbortSignalPlugin`; rpc gives it no special handling.
- A native generator in a value becomes a two-way `AsyncGenerator` on the other side (rpc-generators).

## Changes

- v1: draft, rewritten after the debate: built on `@seroval/transport`, no `rpc-internals` extension contract, no garbage-collection close.
- v2: `RpcSignal` replaces `AbortSignal`; `Functions<T>` is a mapped type so interfaces fit; `CallContext.channel`; a runtime-neutral port, with `transfer` and the postMessage adapter in `@seroval/rpc/post-message` and `fromNodeWorker` in `@seroval/rpc/node` (rpc-spike change request, accepted 2026-11-11).
- v2 (rpc-endpoint, 2026-11-11): `Port.onClose`; `initiator` removed, since keys come from transport; `transfer` left out.
