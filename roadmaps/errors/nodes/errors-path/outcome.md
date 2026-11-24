# Outcome: errors-path

## Built

- Parse errors carry `path`, such as `['users', 3, 'avatar']`. The development message ends with `At $.users[3].avatar`. Production messages are unchanged and carry no path.
- `packages/seroval/src/core/context/parser.ts`: `addErrorPath(error, first, second?)`. It prepends the segments of one container and returns the error to throw.
- `packages/seroval/src/core/context/error-path.ts`: `formatErrorPath(path)`. Pure, so `errors.ts` can import it without a cycle.
- `sync-parser.ts` (also the stream mode) and `async-parser.ts`: one try/catch per container around its child loop (array items, object properties, Map, Set, sequence, ended stream events, boxed value, view buffer) and around the iterator symbol entries. `stream-parser.ts` needed no edit.
- `packages/seroval/test/errors/path.test.ts`: 54 tests, each case in sync, async and stream.

Decisions:

- Which error carries `path`: both. The error the user catches (`SerovalParserError`) has `path`, and so has its `cause` when that is a `SerovalError`. A `SerovalError` raised in the parse gets the segments as it unwinds; the step wrapper copies the final path at construction, as it does for `step`. In stream mode with `onError`, a `SerovalError` reaches the callback with its path, as before.
- Only a `SerovalError` that can take a path is annotated: it is extensible and its `path` is missing or an extensible array. Any other thrown value (a plain error, a plain object, a primitive, an error with a string `path`, a frozen error), and a `SerovalError` that cannot take a path (frozen, or a `path` that is a string, a number or a frozen array), is wrapped in `SerovalParserError` at the innermost catch, kept as `cause`, and never written to. The wrapper owns a copy of the path array when the wrapped error had an array path, and none otherwise.
- Stream `onError` keeps its old contract: a wrapper made only to carry a path around a non-seroval throw is unwrapped before `onError` (and before a synchronous rethrow from the start of the parse), so `err instanceof TheirError` works as on base. That error arrives with no path (same as base). Without `onError` the wrapper with the path is thrown, as in the other modes. The sync and async modes still throw the `SerovalParserError`, as on base.
- Map segments: the entry index, then `'key'` or `'value'`: `$.m[1].key`, `$.m[0].value`. The catch reads `keyNodes[i] === undefined` to tell them apart, so the success path has no extra work. Set segments are the item index.
- The segment names are fixed words, so a real key named `key`, `value`, `valueOf` or `buffer` looks the same in the path as the segment.
- Other segments: boxed value `'valueOf'`, typed array or DataView backing store `'buffer'`, `'Symbol.iterator'` and `'Symbol.asyncIterator'` for those entries (a sequence index follows), ended stream events by index. Error options are an object, so `cause` and the other option keys are ordinary keys.
- Plugin child `parse` callbacks add no segment: the plugin decides the shape, so the path ends at the plugin value and continues with the container segments the child value has itself (`['list', 0, 'deep']` for a plugin value at `list[0]` whose child is `{ deep }`). A plain error thrown by the plugin itself is wrapped under the plugin value's path.
- Late stream values (promise results, async iterable items, stream events after the root) start a new parse root, so their path is relative to that value (`['inner', 0]`). A full path would need the parent path stored when the promise is registered, which costs on the success path. Async mode crosses promises (`parseAsync` awaits inside the container loop), so the path is complete there.
- A root value that fails has no `path` (`undefined`, not `[]`).

## Proof

Production builds, base `origin/release/1.9.0` (5eb4f32e) against the branch, `roadmaps/errors/nodes/errors-path-spike/bench/parse.mjs` with perf-pass `bench.py` (interleaved, 2 warmup runs, 40 runs per cell). Median ms/op, MAD in brackets.

| Cell              | base            | branch          | change | bench.py     | load (1 min) |
| ----------------- | --------------- | --------------- | ------ | ------------ | ------------ |
| sync collection   | 0.3480 (0.0167) | 0.3387 (0.0104) | -2.7%  | within noise | 3.4 to 3.7   |
| sync tree         | 0.4435 (0.0410) | 0.4054 (0.0122) | -8.6%  | within noise | 3.7          |
| async collection  | 0.7288 (0.0029) | 0.7308 (0.0023) | +0.3%  | within noise | 3 to 6       |
| async tree        | 0.9470 (0.0060) | 0.9497 (0.0106) | +0.3%  | within noise | 3 to 6       |
| stream collection | 0.3325 (0.0049) | 0.3262 (0.0027) | -1.9%  | within noise | 2.7 to 3.1   |
| stream collection (rerun) | 0.3291 (0.0012) | 0.3243 (0.0012) | -1.5% | better | 3.0 to 3.4 |
| stream tree       | 0.3729 (0.0039) | 0.3751 (0.0062) | +0.6%  | within noise | 3.4          |

- Async cells are from the run before the fix below; the fix touches only `sync-parser.ts`, which the async parser does not use.
- Cause of an earlier +1.5 to +2.2% in stream collection: a separate `parseItems` function with a try/catch. Removing only that try restored base (+0.0%); moving the try to a separate `parseItems` call from `parseArray` did not help (+1.9%); merging the loop into `parseArray` with the try did (-1.5 to -1.9%). The loop of `parseArray` in `sync-parser.ts` is now inline. The try in `parseProperties` costs nothing measurable. A CPU profile showed the time moving between `parseItems`, `parseProperties` and `parsePlainObject` (inlining), not a new hot function.
- An earlier round on the pre-merge branch (load 4 to 7) gave the same sign in every cell, between +0.1% and +2.6%; that round is superseded.

## Deviations

- `packages/seroval/src/core/errors.ts` (errors-base's file) changed in two places: the `SerovalError` constructor appends `At <path>` to the development message when it is given a path, and it sets `step` on a wrapped seroval error only when that error is extensible (a frozen `SerovalError` made the wrapper throw `TypeError`).
- The helper is in `parser.ts` and `formatErrorPath` is in `error-path.ts` (both owned). The prototype's single file would make a cycle with `errors.ts`.

## Stubs left

- None.

## Gotchas

- The dev message of a step wrapper around a seroval error comes from the catalog entry of the inner code with `{ cause }` as details, so for SRV001 it reads "The value [object Undefined] ..." (errors-base). It now ends with the path, which is the useful part. A later node could build it from the inner message.
- `path` holds user keys, so it must stay out of production messages; it is only a field there.
- `unshift` per level is O(depth^2) on throw only.
- oxfmt reformats the unrelated `createMapNode` call in `parser.ts`; revert that hunk after formatting.

## Proposed learnings

- Annotate errors in parser catch blocks only through `addErrorPath`; never write to a thrown value | user errors can be frozen, primitives or carry their own `path` | packages/seroval/src/core/context | yes (path.test.ts)

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (1532 and 265 tests).
- oxfmt on the changed files; oxlint reports only lines I did not add in the source files, none in `path.test.ts` and `error-path.ts`.

## Size

- Estimated M, actual M.
