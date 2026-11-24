# Outcome: errors-path-spike

## Built

- Recommendation: **build errors-path**, with one `try`/`catch` per container around the whole child loop (not one per child, and no path stack). Success-path cost was within noise in every run, in sync, async and stream parsing.
- `prototype.patch`: the prototype, measured at base 9a11e7a6 (`origin/release/1.9.0`). It adds `packages/seroval/src/core/context/error-path.ts` (`prependErrorPath(error, segment)`) and wraps the child loops of `parseItems`, `parseProperties`, `parseMap` and `parseSet` in `sync-parser.ts` (sync and stream modes) and `async-parser.ts`. The catch reads the loop's current key or index, prepends it to `error.path` and rethrows. Not shipped: `packages/*/src` is unchanged on this branch.
- `bench/parse.mjs`: the harness. `node parse.mjs <sync|async|stream> <collection|tree>`, run from a folder holding a production dist (`index.js`). Sync is `toJSON`, async is `toJSONAsync`, stream is `toCrossJSONStream` until `onDone`. Shapes: 1024 records of `{ id, text, tags: [2], active }`, and a 6-level tree where every level has an object, an array, a Map and a Set (many small containers, the worst case for a per-container try). Fresh inputs per operation, 300 ms warmup, median of 15 batch means per process.
- `bench/results.txt`: raw `bench.py` output for every round.
- Prototype behavior: `toJSON({ a: [1, { b: new Map([['k', { c: new WeakMap() }]]) }] })` throws `SerovalParserError` whose `cause.path` is `["a", 1, "b", 0, "c"]`. Async through a promise: `["x", "y", 1]`. Stream: `["s", 0]`.

## Proof

- base: production dist of 9a11e7a6, copied out before the patch.
- branch: production dist of 9a11e7a6 plus `prototype.patch`.
- Command per cell: `bench.py --dir base=<base dist> --dir proto=<proto dist> --metric 'ms/op: ([\d.]+)' -- node bench/parse.mjs <mode> <shape>`. Runs interleave base and proto processes.
- Machine: 8-core Mac, Node from the repo toolchain. Load average was 5 to 19 throughout (other roadmap agents), above half the core count; rounds were repeated for that reason. bench.py marks a change real only beyond 3x the larger MAD: **every cell in every round was "within noise"**.

Change of proto median vs base median (ms/op base median in brackets):

| Cell              | R1 (10 runs, load 10-19) | R2 (10 runs, load 9-19) | R3 (10 runs, load 5-8) | R4 (20 runs, load 4-12) | R5 (30 runs) |
| ----------------- | ------------------------ | ----------------------- | ---------------------- | ----------------------- | ------------ |
| sync collection   | -21.5%                   | +7.1%                   | +2.3% [0.331]          | +0.0% [0.354]           |              |
| sync tree         | -9.6%                    | +14.5%                  | -3.0% [0.451]          | -1.3% [0.621]           |              |
| async collection  | +6.1%                    | +12.6%                  | +0.9% [0.730]          | +0.4% [0.988]           |              |
| async tree        | -5.2%                    | -3.4%                   | -0.8% [0.984]          | -4.1% [1.062]           |              |
| stream collection | +1.3%                    | +2.0%                   | +0.0% [0.363]          | +0.9% [0.332]           |              |
| stream tree       | +25.0%                   | -1.8%                   | +5.9% [0.416]          | +17.8% [0.506]          | -0.7% [0.966] |

- In the quieter rounds (R3, R4) the collection cells are within +-2.3% and the MADs are 1-8% of the median; the swings in R1 and R2 go both ways and follow the load.
- Stream tree is bimodal under load (samples cluster near 0.37 and near 0.5+ ms on both sides). The minimums match: R2 0.3709 vs 0.3708, R3 0.3691 vs 0.3691, R4 0.3694 vs 0.3708. The 30-run repeat gave -0.7%. No measurable cost.
- Size: the unminified ESM `write` chunk grows from 17,674 to 17,911 bytes gzip (+237 B) for the prototype.

## Deviations

- Measured with my own harness under the node folder instead of `benchmark/reports/measure.mjs`, because that harness needs two full installed checkouts and has no deep many-container shape. `bench.py` was used as the task asked.
- Map and Set segments are the entry index, since `path` is `(string | number)[]` and Map keys need not be strings.

## Stubs left

- None. The prototype is only a patch.

## Gotchas

For errors-path:

- The prototype writes `path` onto any thrown object, including a non-seroval error a plugin throws (a user object would be mutated). Annotate only `SerovalError` instances; for other errors, wrap them in `SerovalParserError` at the innermost container catch (`parseTop` already passes a `SerovalParserError` through unwrapped), then add segments to the wrapper.
- `unshift` per level is O(depth^2) on throw; push and reverse once in `parseTop` (and the async and stream tops) if depth limits are large. Cost is on throw only either way.
- Not covered by the prototype: `parseBoxed`, `parseView`, the `Symbol.iterator` / `Symbol.asyncIterator` entries in `parseProperties`, `parseSequence` (sync-parser.ts:516), plugin child `parse` callbacks, and stream-parser.ts:463. Each needs a segment choice (for example a fixed name like `'value'` or the symbol description).
- Stream mode: values that arrive later (promise results, async iterable items, stream events) start a new `parseSOS` root without their ancestors, so their path is relative to that value. A full path there means storing the parent path when the promise is registered, which costs on the success path; keep it relative or measure that separately.
- In async mode the path does cross promises, because `parseAsync` awaits inside the container loop.
- The machine was loaded the whole time. A quiet rerun of `bench/parse.mjs` on the real errors-path branch is still worth doing (the perf-pass "measure once against the baseline" step).

## Proposed learnings

- One try/catch around a container's child loop, reading the loop variable in the catch, costs nothing measurable in seroval's parsers on V8 | measured in this spike (all cells within noise) | packages/seroval/src/core/context | no

## Verification

- `pnpm --filter seroval build` and `pnpm --filter seroval test` with the prototype applied: 89 files, 1440 tests passed.
- `oxlint` and `oxfmt --check` on `bench/parse.mjs`: clean apart from the `no-console` warning for its output line.
- No source change ships on this branch, so the fast check was not rerun after reverting.

## Size

- Estimated S, actual S.
