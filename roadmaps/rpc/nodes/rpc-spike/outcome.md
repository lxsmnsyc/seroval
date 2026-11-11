# Outcome: rpc-spike

## Built

- `packages/rpc` as `@seroval/rpc` 0.0.0. `seroval ^1.8.0` and `@seroval/transport ^0.1.1` are peer dependencies and workspace dev dependencies. One entry point (`src/index.ts`), tsdown ESM and CJS, `"test": "vitest run"`, `vitest.config.ts` includes `test/**/*.test.ts`.
- `src/types.ts`: `CallContext`, `Functions`, `Caller`, `Channel`, `ChannelOptions`, `IncomingCall`, `EndpointOptions`, `MessagePortLike`, `Endpoint`.
- `src/errors.ts`: working `RpcClosedError`, `RpcTransportError`, `RpcRemoteError` (with `remoteName`).
- `src/index.ts`: `createChannel`, `createEndpoint`, `transfer` stubs that throw "not implemented"; re-exports types and errors.
- Worker example in `test/example/`: `api.ts` (the typed functions: `load` with a progress channel argument, `search`, `scan` plus `scanWasCancelled`, `browse` as a two-way generator, `quit`), `worker.ts` (a `worker_threads` worker), `search.test.ts` (one passing surface test and six `it.skip` tests tagged rpc-endpoint, rpc-channels, rpc-streaming or rpc-generators). `test/support/node-port.ts` adapts a `Worker` or `parentPort` to `MessagePortLike`.

## Deviations

- Added types the contract does not list: `Caller` (what `with()` returns, replaces `Pick<Channel, 'run' | 'notify'>`), `ChannelOptions`, `IncomingCall`, `Endpoint`, `MessagePortLike`. `RpcRemoteError` takes `(remoteName, message)`.
- `tsconfig.json` has `allowImportingTsExtensions` and `noEmit` (the worker is a `.ts` file that Node runs with type stripping).

## Stubs left

- `createChannel`, `createEndpoint`, `transfer` throw. Everything the six skipped tests need is behind them: rpc-endpoint (calls, `run` of `search`), rpc-channels (channel as argument, close from both ends), rpc-streaming (cancel via `with({ signal })` and `this.signal`), rpc-generators (two-way `browse`).

## Gotchas

- The worker imports `@seroval/rpc` by its own name, because Node cannot load `src/index.ts` (extensionless imports). `tsc` therefore needs `dist`; run `pnpm --filter @seroval/rpc build` before `tsc -p packages/rpc`. Unskipped worker tests also need a build first (the fast check builds anyway).
- `Functions` must be a `type` alias or `typeof obj`. An `interface` has no index signature and fails the constraint.
- Node `Worker` has no `addEventListener`, and DOM and Node declare different `Transferable` types, so `toPort` needs a cast.
- Closing a `Worker` port must not call `worker.terminate()` while close messages are in flight. The adapter closes only a real `MessagePort`; the worker closes its own `parentPort` when the endpoint closes, then exits.
- Listen for the worker `exit` before closing, or the exit can be missed.
- Key retention (for rpc-endpoint): `writer.write(key, ...)` keeps `key` in the `written` Set for the writer's life, so `a<id>`/`r<id>` keys grow that Set by one per call, against the acceptance "10,000 sequential calls leave no growing Set". `push()` keeps no state, but its key is the writer's next number, which the peer must be able to predict. Argument keys can use `push()` on one writer per direction (the n-th call is key n). Result keys do not follow call order, since results start out of order, so either send the result key in a control message or use one result writer per call. Decide in rpc-endpoint. A transport change that frees a `written` key once it settles would fit the protocol as written.

## Awkward API

1. `run` returns `Promise<AsyncGenerator>` for a generator function; the caller must `await` before the first `next()`. It reads oddly next to a local generator.
2. The same `Channel<T>` type is both the owner (made by `createChannel`) and the holder (from `connect()`). The owner's `close()` and a holder's `close()` look the same, and the owner can `run` its own functions.
3. A progress channel names its function type twice: once for `createChannel<ProgressFunctions>` and once in the callee's parameter `Channel<ProgressFunctions>`.
4. `notify('report', ...)` on a channel argument returns `void`; progress wants `notify`, but a closed channel then fails silently.
5. `Functions` forbids `interface` types (no index signature), and the `this: CallContext` constraint means every callee that wants the signal annotates `this` by hand.
6. What a cancelled `run` rejects with is not in the contract. The example assumes the abort reason; the contract should say so.
7. `with({ signal })` returns a `Caller`, not a `Channel`, so the signal-bound view cannot be passed as a channel argument or closed.
8. `run`, `notify`, `with`, `close` and `closed` are reserved names; a function named `close` collides with the channel method, and the types only show it through `keyof T`.
9. `createEndpoint` takes a `MessagePortLike`, but Node `Worker` and `parentPort` need an adapter (`on` vs `addEventListener`, different `Transferable`). Every Node user writes `toPort`; a Node entry point should ship it.
10. `connect<T>()` takes the type argument only; nothing checks it against what the other side serves. `serve(root: Channel<Functions>)` loses the specific type.
11. Closing from the worker needs a `quit` function that reaches the root channel through shared state, because the functions need the channel and the channel needs the functions (the worker uses a `lifecycle` object).
12. After closing, `closed` resolves but the caller cannot learn that the worker exited; the example listens to the `Worker` `exit` event itself.
13. `window` in `EndpointOptions` is one number for every stream; no per-call override.

## Proposed learnings

- Self-name imports (`@seroval/rpc`) run `.ts` worker files that use the package; keep a build step in the fast check.
- Keep the Node port adapter in `test/support`; no Node APIs in the core.

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc build && pnpm --filter @seroval/rpc test`: pass (1 passed, 6 skipped).
- `npx tsc -p packages/rpc`: pass, after the build.
- `npx oxlint` on the package: 0 errors, 2 `no-explicit-any` warnings in `EndpointOptions.plugins` (as in the contract). `npx oxfmt` applied to the new files.
- `pnpm -r build && pnpm -r test`: see the PR for the result.

## Size

M, as sized. About 450 lines across 11 files.
