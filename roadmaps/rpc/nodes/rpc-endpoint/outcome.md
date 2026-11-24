# Outcome: rpc-endpoint

## Built

- `src/endpoint.ts`: `createEndpoint(port, options)` and `Port`. One JSON writer and reader from `@seroval/transport` per endpoint. Hello `[3, 1, rootId]` on `serve`; `connect()` returns the root receiver at once and holds its calls (in order) until hello. Calls `[channelId, name, args]` and results `[callKey, value]` go through `writer.push()`. `notify`, `onCall`, `this.channel`, `RpcRemoteError` (name and message only), protocol version check, `owned`/`remote` maps, `[6, id, side]` close of a channel (side 0: the holder closed, the receiver looks in `owned`; side 1: the owner closed, the receiver looks in `remote`), and endpoint close or transport failure with calls in flight. `inspectEndpoint(endpoint)` (not exported from the index) reports map sizes for tests.
- `src/channel.ts`: `createChannel` (IDs from a module counter), in-place calls on local channels, `startCall`, `closeOwner`, `wrapBackend` (the public `Channel` over a backend, including `with({ signal })`, which rejects locally with the signal reason).
- `src/post-message.ts` (`@seroval/rpc/post-message`): `fromMessagePort(source)` for `Worker`, `MessagePort` and the worker scope; a `close` event fails calls in flight.
- `src/node.ts` (`@seroval/rpc/node`): `fromNodeWorker(worker | parentPort)`. `test/support/node-port.ts` is removed; the worker and tests use it.
- `src/index.ts` exports `createChannel`, `createEndpoint`, `Port`, errors, signal, types. 
- `package.json` exports `./node` and `./post-message`; `tsdown.config.ts` builds all three entries.
- Tests: `test/endpoint/endpoint.test.ts` (30 tests: sync and async in-memory pair, `MessageChannel` through both adapters, ordering, errors, onCall, version, close in flight, transport failure, 10,000 calls). The worker example's first test now runs for real.

## Decisions for rpc-docs

- Port shape: `{ send(message), onMessage(listener) => stop, onError?(listener) => stop, onClose?(listener) => stop, close?() }`. `onClose` was added to the contract's sketch.
- Error flag: a failed result is `[callKey, { name, message }, 1]`; success is `[callKey, value]`. A failure named `RpcClosedError` is rebuilt as `RpcClosedError`; every other name becomes `RpcRemoteError(name, message)`.
- `notify` is a call with a fourth element `1`.
- `callKey` is the transport key (a string) of the call.
- Close is `[6, id, side]`, a change to rpc-protocol the orchestrator accepted.
- Messages 4 (credit) and 5 (cancel) are ignored until rpc-streaming.

## Deviations

- `MessagePortLike` moved from `src/types.ts` to `src/post-message.ts` (it names `Transferable`, a DOM type; the core has none). `types.ts` lost it; the index no longer exports it.
- `test/example/api.ts`: `load`'s `progress` is optional, so the endpoint node can run `load` with no channel. `typing.ts` uses `Port`.
- `transfer` is removed (a no-op that looks like it moves a buffer is a trap). The contract's `transfer` is not built.
- `EndpointOptions.initiator` is removed from `types.ts`, its doc and uses: calls use transport keys, so it had no effect.
- Basic channel close (`close()`, `closed`, `[6, id, side]`, `onClose`) is built because the types require it. Close order, nested `onClose` and the worker close tests stay with rpc-channels.
- No transport change, no changeset. No change request.

## Follow-ups

- `transfer` needs a seroval plugin: JSON mode serializes buffers into the message, so the object never reaches `postMessage` as is.
- The queue of incoming calls that wait for `serve` has no bound (for rpc-docs).

## Stubs left

- Five worker tests stay `it.skip`: progress channel (rpc-channels), cancel (rpc-streaming), two-way generator (rpc-generators), close from both ends (rpc-channels).
- Remote cancel: `with({ signal })` rejects the caller locally only; the callee's `this.signal` aborts only on channel or endpoint close (rpc-streaming).
- `window` option unused (rpc-streaming).

## Gotchas

- Lint: `channel.ts` and `endpoint.ts` disable `promise-function-async` (calls must start synchronously, in order) and the unsafe-assertion rules at the generic boundary.
- A call that arrives before `serve` waits; one for an unknown ID after `serve` fails the caller with `RpcClosedError`.
- A failure of a value after its first message (a stream) is not reported to the caller; only a failure while pushing is.
- The worker imports `@seroval/rpc` and `@seroval/rpc/node` from `dist`, so build first.
- Test ports must buffer messages until a listener attaches (as `MessagePort` does), or hello is lost.

## Proposed learnings

- Detect new keys from the peer by `key >= nextKey` and request them from the reader at once | frees reader slots and keeps `reader.size` at 0 | packages/rpc/src | yes (inspectEndpoint test)

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc build && pnpm --filter @seroval/rpc test`: pass (36 passed, 5 skipped), three runs.
- `npx tsc -p packages/rpc`: pass after the build.
- `oxlint` on the changed files: 0 errors (warnings: `any` in `EndpointOptions.plugins`, `no-useless-spread` where the loop mutates the collection).
- Core files import no Web or Node API (grep for Transferable, AbortSignal, MessagePort, EventTarget finds only `node.ts` and `post-message.ts`).

## Size

- Estimated M, actual M. About 700 lines of source and 280 of tests.
