---
name: rpc-api
version: 1
status: draft
defined_by: rpc-docs
---

# Contract: rpc-api

## Purpose

The public API of `@seroval/rpc`. It stays a draft through the chain and freezes at rpc-docs, after the worker example has run on real code (debate P1, O5).

## Interface

The spike writes the first version to `packages/rpc/src/types.ts`.

```ts
type Functions = Record<string, (this: CallContext, ...args: never[]) => unknown>;

interface CallContext {
  /** Aborts when the caller cancels or the endpoint closes. Valid across awaits. */
  readonly signal: AbortSignal;
}

interface Channel<T extends Functions> {
  run<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): Promise<Awaited<ReturnType<T[K]>>>;
  notify<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): void;
  with(options: { signal?: AbortSignal }): Pick<Channel<T>, 'run' | 'notify'>;
  close(): void;
  readonly closed: Promise<void>;
}

function createChannel<T extends Functions>(functions: T, options?: { onClose?(): void | Promise<void> }): Channel<T>;

interface EndpointOptions {
  initiator: boolean;
  plugins?: Plugin<any, any>[];
  onCall?(call: { name: string; args: unknown[]; context: CallContext }, next: () => Promise<unknown>): Promise<unknown>;
  window?: number;
}

function createEndpoint(port: MessagePortLike, options: EndpointOptions): {
  serve(root: Channel<Functions>): void;
  connect<T extends Functions>(): Channel<T>;
  close(reason?: unknown): void;
};

function transfer<T extends Transferable>(value: T): T;

class RpcClosedError extends Error {}
class RpcTransportError extends Error {}
class RpcRemoteError extends Error {}
```

## Behavior

- Calls on one channel start on the callee in the order they were made.
- `run`, `notify`, `with` and `close` are channel methods, so functions may use those names.
- After a close, `run` rejects with `RpcClosedError` and handles its own rejection.
- Close order: stop taking messages, close channels, stop sent streams, fail read streams, run `onClose` nested first and root last. A throwing `onClose` is reported and the rest run.
- A native generator in a value becomes a two-way `AsyncGenerator` on the other side (rpc-generators).

## Changes

- v1: draft, rewritten after the debate: built on `@seroval/transport`, no `rpc-internals` extension contract, no garbage-collection close.
