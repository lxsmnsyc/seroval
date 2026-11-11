# Change request: rpc-api v1 to v2

- From node: rpc-spike (orchestrator, with the maintainer, 2026-11-11)
- Status: accepted

## Problem

- The core is meant to need no Web API. v1 uses `AbortSignal` for `with({ signal })` and `this.signal`.
- `Functions` was a `Record`, so an `interface` did not fit.
- A function that closes its own channel had to reach it through shared state.
- `transfer<T extends Transferable>` and `MessagePortLike` name DOM types in the core; `lib: DOM` in the tsconfig hides this.

## Proposed change

- `RpcSignal { aborted; reason; onAbort(listener): () => void }` replaces `AbortSignal` in `CallContext.signal` and in `with({ signal })`. `createRpcSignal()` returns `{ signal, abort(reason) }`. A real `AbortSignal` is the user's to convert. A signal inside a value needs the user to register `AbortSignalPlugin`; rpc gives it no special handling.
- `Functions<T> = { [K in keyof T]: RemoteFunction }`, where `RemoteFunction = (this: CallContext, ...args: never[]) => unknown`. Interfaces fit, and `this` is typed from context with no annotation.
- `CallContext.channel: Channel<Functions>` is the channel the call came in on.
- `createEndpoint` takes a runtime-neutral port, decided by rpc-endpoint, for example `{ send(message), onMessage(listener) => remove, onError?(listener), close?() }`. `transfer()` and the `postMessage` port adapter move to `@seroval/rpc/post-message`. `fromNodeWorker(worker)` ships in `@seroval/rpc/node` (approved by the maintainer).
- A cancelled `run` rejects with the signal's `reason`.

## Affected nodes

- rpc-endpoint: the port, the entry points, `this.channel`.
- rpc-streaming: `RpcSignal` for `with` and `this.signal`.
- rpc-docs: freezes v2.

## Workaround in place

- `packages/rpc/src/types.ts` and `src/signal.ts` already have `RpcSignal`, `createRpcSignal`, `Functions<T>` and `CallContext.channel`. `MessagePortLike` and `transfer` still name DOM types until rpc-endpoint moves them.

## Decision

- Accepted. The maintainer asked for a core with no Web API (2026-11-11) and approved `@seroval/rpc/node`.
