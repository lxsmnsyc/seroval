# Outcome: rpc-channels

## Built

- `src/channels/plugin.ts`: `createChannelPlugin(hooks)` is a seroval plugin that writes a channel as `{ i: id }` only. It carries no streams. One plugin per endpoint, put first in the plugin list of the writer and the reader.
- `src/endpoint.ts`: `registerChannel` (send) puts a channel made by `createChannel` in `owned` under its ID and watches it. It refuses a second, different channel under an ID `owned` holds (the send fails with `RpcTransportError`), and a closed channel or endpoint (`RpcClosedError`). `resolveChannel` (receive) reuses one holder and receiver per remote ID in `remote`. `watchOwned` sends `[6, id, 1]` when an owner closes. `serve` reuses it and records `rootCore`.
- Closing the root closes the endpoint on both sides: the owner's root watcher and the holder's root `closeHolder` call `shutdown`.
- Close order in `shutdown`: stop taking messages (`closed`), close holders, `stopOwner` on owned cores (nested in reverse send order, root last: marks closed, aborts running calls, tells the peer), then `writer.close` (stop sent streams), `reader.end` (fail read streams), then `onClose` one channel at a time in the same order. A throwing `onClose` is reported as an unhandled rejection and the rest run.
- `src/channel.ts`: `closeOwner` split into `stopOwner` (sync half) and `finishOwner` (runs `onClose`, awaits the optional `core.finishAfter`).
- Worker example: progress channel and both close tests are on. The two-way generator test stays `it.skip`.
- Tests: `test/channels/channels.test.ts` (10 tests): new channel per call, channel in an argument with callbacks, same receiver sent twice (and returned twice), ID clash refused, run after close rejects with no unhandled rejection, holder close and owner close (one `onClose`, `closed` on both sides), root close order, root closed from the holder, throwing `onClose`.

## Proof

None (feature node).

## Deviations

- `src/channel.ts` is outside the brief's paths (the close split needed it). `test/streaming/pair.ts` is reused by the channels tests, unchanged.
- The ID-clash test sets `getOwnerCore(channel).id` by hand, since one module copy never repeats an ID.

## Stubs left

- Two-way generator test stays `it.skip` (rpc-generators).

## Gotchas

- The channel object is a plain object, so the plugin must not set `skipPlainObjects`.
- A channel sent but never closed stays in `owned` until the endpoint closes (no garbage-collection close, a non-goal). For rpc-docs.
- Sending a channel received from the other side back to it is not supported. Only channels made by `createChannel` pass the plugin test, so it fails as an unserializable function.
- A call to an ID missing from `owned` on an endpoint that never called `serve` waits for `serve` (unchanged behavior).
- oxlint and oxfmt ignore files under `.claude/worktrees`. Use `oxlint --no-ignore` and `oxfmt --ignore-path=<empty file>` there.

## Proposed learnings

- A seroval plugin for an object made by a factory (a plain object with methods) must not set `skipPlainObjects` | the parser skips plain objects before `test` | packages/rpc/src/channels | no
- Split an async close into a sync stop half and an async finish half so a shared shutdown can order cleanups | packages/rpc/src/channel.ts | no

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc build && pnpm --filter @seroval/rpc test`: pass (68 passed, 1 skipped).
- `npx tsc -p packages/rpc --noEmit`: pass.
- `oxlint` and `oxfmt` on the changed files: clean.

## Size

- Estimated M, actual M. About 150 lines of source and 230 of tests.
