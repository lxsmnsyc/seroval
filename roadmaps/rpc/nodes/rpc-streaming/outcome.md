# Outcome: rpc-streaming

## Built

- `src/streaming/gate.ts`: `createCreditGate(window)`, `resolveWindow`, `isStreamItem`. The writer counts the stream items sent under each key and returns a promise from the transport `send` once `window` items are not credited, which holds the source back. `DEFAULT_WINDOW` is 16.
- `src/streaming/watch.ts`: `watchStreams(value, window, hooks)` wraps the async iterables in a value the other end sent (found in arrays, plain objects, maps and sets). Consuming an item gives credit back (batched at `max(1, window >> 1)`). Leaving a stream early (`break`, `return`, `throw`) cancels the value once every stream in it ended. Errors out of a stream become `RpcRemoteError` (name and message only), `RpcClosedError`/`RpcTransportError` stay as they are.
- `src/endpoint.ts`: control messages 4 and 5 are wired. `[4, key, n]` credits the writer; `[5, key]` makes the writer cancel `key` (the producer's `finally` runs); `[5, key, 1]` cancels a running call: the callee's `this.signal` aborts with an `RpcClosedError` and no reply is sent. `with({ signal })` sends the cancel and drops the pending entry. A call whose signal aborted before hello never goes out. A reply that arrives for a cancelled call is cancelled at once. `window` in `EndpointOptions` is used, and validated (`RangeError` for a non-positive-integer). `inspectStreaming(endpoint)` (not exported from the index) reports `running` and `windowKeys` for tests.
- `src/channel.ts`: `startCall` takes an optional controller, so the endpoint can abort a call.
- Tests: `test/streaming/streaming.test.ts` (12 tests) and `test/streaming/pair.ts`. The worker example's cancel test now runs for real.

## Proof

- base: c1049c3d, `pnpm --filter @seroval/rpc exec vitest run test/streaming/midway.test.ts` (the midway test alone): failed, `expected TypeError: midway to be an instance of RpcRemoteError`. The brief said the failure was not reported; it is reported, but as a plain `TypeError` rebuilt by seroval.
- branch: the same test (`rejects the reader with RpcRemoteError when the stream throws midway`) passes and checks `remoteName: 'TypeError'`, `message: 'midway'` and no `cause`.

## Deviations

- `src/channel.ts` is not in the brief's paths; the one-line change (optional controller on `startCall`) was needed to abort a call from the endpoint.
- The bug in the brief is the error class, not a missing report (see Proof).
- No transport change, no changeset (rpc is unreleased).

## Stubs left

- Four worker tests stay `it.skip`: progress channel and both closes (rpc-channels), two-way generator (rpc-generators).

## Gotchas

- Change request `contracts/rpc-protocol.change-request.md`: `[5, key]` cannot cancel both a value and a call because keys are per direction, so a call cancel is `[5, key, 1]`. `[4, key, n]` means n items consumed. Both ends should use the same `window`: the writer starts with its own `window` of credit.
- Seroval's reader buffers every item it receives, so the window only holds back the producer; the credit comes from wrapping the iterable the reader hands out. A stream outside arrays, plain objects, maps and sets (inside a class instance or a plugin value) is not wrapped, so its producer stalls after `window` items. Documenting this belongs to rpc-docs.
- Stream items are recognised by seroval's node type `t === 32` (`StreamNext`), which seroval does not export. A seroval change of that number breaks the window; the window test would catch it.
- A cancel that arrives for a call that still waits for `serve` is lost (the call then runs). Notify calls cannot be cancelled.
- A value with several streams shares one window and one credit count; the key is cancelled only when all of its streams ended and one was left early.
- Tests that time a slow reader count items (`probe.produced`), never milliseconds.

## Proposed learnings

- A source that can throw without a promise (seroval's async iterator `next`) must be called inside an async function or promise | a sync throw skips the `.then` error handler | packages/rpc/src/streaming | no
- Test hold-back by counting produced items at rest (`settle()` then read the counter) | no wall-clock timing | packages/rpc/test | yes

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc build && pnpm --filter @seroval/rpc test`: pass (50 passed, 4 skipped), three runs.
- `npx tsc -p packages/rpc --noEmit`: pass.
- `oxlint` and `oxfmt` on the changed files: clean.

## Size

- Estimated M, actual M. About 400 lines of source and 300 of tests.
