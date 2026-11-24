---
id: errors-path
title: Value paths in parse errors
status: todo
priority: should
type: feature
story: 
early: false
outline: false
milestone: 
target: 
ship: auto
size: M
spike: false
verify: 
exclusive: []
gate: false
owns:
  - packages/seroval/src/core/context/sync-parser.ts
  - packages/seroval/src/core/context/async-parser.ts
  - packages/seroval/src/core/context/parser.ts
  - packages/seroval/src/core/context/error-path.ts
  - packages/seroval/test/errors/path.test.ts
shared:
  - packages/seroval/src/core/context/stream-parser.ts
reserves: []
provides: []
depends_on:
  - on: errors-path-spike
    kind: hard
    why: the measured cost decides the approach, or drops the node
  - on: errors-base
    kind: hard
    why: edits stream-parser.ts after errors-base changes its throw
---
# Value paths in parse errors

## Goal

Parse errors carry `path`, such as `['users', 3, 'avatar']`, and the development message shows it as `$.users[3].avatar`. Build it the way errors-path-spike recommends: one try/catch per container around its child loop, prepending the key or index on throw. The maintainer approved the spike on 2026-11-24 with these conditions (details in `nodes/errors-path-spike/outcome.md`):

- Annotate only `SerovalError`. Wrap any other thrown value in `SerovalParserError` at the innermost catch and keep the original as `cause`. Never write to a user's object: an error with a string `path` or a frozen error must survive unchanged.
- Decide which error carries `path` (the prototype leaves it on `cause`) and state it in the outcome; the contract's `path` field is on the error the user catches.
- Decide whether Map segments mark key or value, and document it.
- Cover the call sites the prototype missed: boxed values, views, iterator symbol entries, `parseSequence`, plugin child `parse` callbacks, `stream-parser.ts:463`.
- Late stream values get a path relative to their own parse; document that, do not pay for full paths on the success path.
- The helper may live in `core/context/error-path.ts` (owned) or `parser.ts`.

## Acceptance

- [ ] `path.test.ts` covers objects, arrays, maps, sets and plugin values in all three parsers.
- [ ] `path.test.ts` has one test each for a thrown error with a string `path`, a frozen error, a plain object and a primitive, and each original is still reachable as `cause`.
- [ ] perf-pass shows no slowdown above noise on the success path, rerun on a quiet machine (`nodes/errors-path-spike/bench/parse.mjs` with `bench.py`). Any cell above noise goes to the maintainer before the PR is marked ready.
- [ ] Fast check passes.

## Sizing

M: three parsers with the same change.
