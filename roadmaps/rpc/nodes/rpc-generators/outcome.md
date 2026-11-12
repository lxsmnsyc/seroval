# Outcome: rpc-generators

## Built

- `src/generators/plugin.ts`: `createGeneratorPlugin({ sendChannel, receiveChannel })`. `test` matches `[object Generator]` and `[object AsyncGenerator]`. The sender wraps the generator in a hidden `createChannel` with `next`, `throw` and `return`, registers it with the endpoint and writes its ID. The receiver turns the remote channel into an `AsyncGenerator` object (with `Symbol.asyncIterator` and `Symbol.asyncDispose`). A sync generator becomes an async one.
- The receiver closes the hidden channel when a step is done or fails (any rejection). After that it answers locally like a finished native generator. `return()` and a `break` send `return` to the real generator, so its `finally` runs.
- The hidden channel's `onClose` calls `generator.return()` without waiting, so an early close (endpoint closed) still runs the generator's `finally`.
- `src/endpoint.ts`: the generator plugin is registered after the channel plugin and before user plugins, using `registerChannel` and `resolveChannel`.
- Other async iterables keep the one-way stream with the credit window.
- Worker example: the two-way generator test is on. No `it.skip` is left in `packages/rpc/test`.
- Tests: `test/generators/generators.test.ts` (17 tests): `next(value)` reaches `yield`, sync generator, `throw` caught and uncaught, generator that throws, `return()` and `break` run `finally`, generator in an argument and in a result, one-way iterable still streams, pending `next` rejects with `RpcClosedError` when either endpoint closes, hidden channel not left in `owned` after finish, return, throw, break and for an argument generator.

## Proof

None (feature node).

## Deviations

- `test/streaming/streaming.test.ts` is outside the brief's paths. Its tests used native async generators as one-way streams, and those now go two-way, so it got a `sendOneWay` helper that hides the generator behind a plain async iterable. The assertions did not change.
- Q5 followed: no `stream(generator)` marker. A plain async iterable is the way to force the one-way push.

## Stubs left

- None.

## Gotchas

- Any native generator or async generator in a value is now two-way, including ones that used to stream. Code that needs the one-way push with credit must send a plain async iterable (an object with `Symbol.asyncIterator`). For rpc-docs.
- The sender does not close the hidden channel itself. The receiver does, once a step is done or fails. A receiver that drops the generator without `return()` leaves the channel in `owned` until the endpoint closes (no garbage-collection close, a non-goal).
- `shutdown` clears `owned` before `stopOwner`, so closing an endpoint sends no close message for nested channels. The peer learns through `Port.onClose`. A port without `onClose` leaves a pending `next` waiting.
- `next(value)` on the first call is ignored, as for any generator.
- A remote error from a step arrives as `RpcRemoteError` (name and message only), not the original error. `throw(error)` sends the error as an argument, so the generator sees a seroval-cloned `Error`.
- oxlint and oxfmt ignore files under `.claude/worktrees`. Use `oxlint --no-ignore` and `oxfmt --ignore-path=<empty file>` there.

## Proposed learnings

- Do not await `generator.return()` in a close hook | a generator stuck in a step queues the return forever and blocks the close chain | packages/rpc/src/generators | no
- Close a request-reply channel from the receiving side after the last reply | a close sent from inside the last call beats its result and rejects it | packages/rpc/src/generators | no

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc build && pnpm --filter @seroval/rpc test`: pass (86 passed, 0 skipped).
- `npx tsc -p packages/rpc --noEmit`: pass.
- `oxlint --no-ignore` and `oxfmt` on the changed files: clean.

## Size

- Estimated S, actual S. About 140 lines of source and 370 of tests.
