# Outcome: rpc-transport-fixes

## Built

- Most steps were already on main before this node started:
  - The rebase and merge: `@seroval/transport` landed through #259 and later PRs, and 0.1.1 is published.
  - The writer frees a key when its value settles: `settle()` deletes it from `active` (`packages/transport/src/write.ts`). Keys from `push` need no entry in `written`.
  - The reader frees a settled key's slot once `get` and `settled` were both called (b9662637), and caps keys nobody requested.
  - Cancelling: `Writer.cancel(key)` stops a value and its sources; `Reader.cancel(key)` drops its later messages. rpc carries the reader's request as its control message `[5, key]` and calls `writer.cancel` on the other end.
  - 10,000 sequential keys: "Reader memory > keeps no state for 10,000 sequential values" in `packages/transport/test/transport.test.ts` checks `reader.size` stays 0 and that the writer's `onDone` fires after `flush`, which needs `active` to be empty.
- New in this node: `packages/transport/test/plugin.test.ts`, with a plugin value in a value, in an async iterable chunk, and in a value written after another key was cancelled on both ends.

## Deviations

- The writer exposes no `size`. Its bound is checked through `onDone`, not a count.

## Stubs left

- None.

## Gotchas

- Keys passed to `writer.write` stay in its `written` Set for the writer's life, so a key cannot be reused. rpc should use `push` for call keys, which keeps no state.
- Plugins go in both `createJSONWriter({ plugins })` and `createJSONReader({ plugins })`.

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/transport test`: 5 files, 81 tests pass.

## Size

- Estimated M, actual S. The fixes landed through the 1.7.x and 1.8.0 security and transport work.
