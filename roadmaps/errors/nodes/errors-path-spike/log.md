# errors-path-spike log

## 2026-11-24

- Base: `origin/release/1.9.0` at 9a11e7a6. No earlier path measurement or prototype found (`git log --all` has no path or spike commit for errors; `errors.ts` has no `path` yet, only the frozen `CatalogDetails` field in `error-catalog.ts:95`).
- Approach prototyped: one `try`/`catch` per container, around the whole child loop, not per child. The catch reads the loop's current key or index and prepends it to `error.path`, then rethrows. Success path cost is one try region per object, array, Map and Set; no per-child work, no path stack. Covered: `parseItems`, `parseProperties`, `parseMap`, `parseSet` in `sync-parser.ts` (sync and stream modes) and `async-parser.ts`. Patch: `prototype.patch`.
- Map and Set segments are the entry index (Map keys need not be strings).
- Prototype check: `toJSON({ a: [1, { b: new Map([['k', { c: new WeakMap() }]]) }] })` gives `cause.path = ["a",1,"b",0,"c"]`; async through a promise gives `["x","y",1]`; stream gives `["s",0]`. All 1440 seroval tests pass with the prototype.
- Harness: `bench/parse.mjs` (sync `toJSON`, async `toJSONAsync`, stream `toCrossJSONStream` to `onDone`; shapes: 1024-record collection, and a 6-level tree of objects, arrays, Maps and Sets). Each process warms 300 ms, takes 15 batch means, prints the median. `bench.py` interleaves base and proto processes. Both sides are production dists of the same commit, copied out of the worktree (baseline before the patch, proto after).
- Machine load: 8 cores, load average 9.76 / 8.28 / 7.19 at 10:09, well above half the core count (other agents running). Measured anyway with repeated rounds; spread reported per round.
- Rounds 1-3 (10 runs each) and round 4 (20 runs) of all six cells, then stream tree alone with 30 runs. Load stayed 4-19. Every cell in every round was "within noise" per bench.py. Raw output in `bench/results.txt`, table in `outcome.md`.
- Size: unminified ESM write chunk +237 B gzip.
- Prototype reverted from `packages/seroval/src`; it lives only in `prototype.patch`.
- Recommendation: build errors-path with one try/catch per container. Caveats (do not mutate non-seroval errors, uncovered call sites, stream roots without ancestors) are in `outcome.md`.
