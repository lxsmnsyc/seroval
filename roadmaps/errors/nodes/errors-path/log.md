# errors-path log

## 2026-11-24

- Branch `feat/errors-path` reset to `origin/release/1.9.0` (c55c8465). No earlier path work found.
- Did not apply `prototype.patch`. The helper is `addErrorPath` in `parser.ts` (it needs `SerovalParserError`); `error-path.ts` holds only the pure `formatErrorPath`, so `errors.ts` can import it without a cycle.
- Catch per container around the child loop in sync, async and stream (stream shares `sync-parser.ts`). `stream-parser.ts` needed no edit: its roots call `parseSOS`, and the paths come from the containers.
- Async `parseItems`/`parseProperties` read the values before the walk, so those reads sit inside the same try (a throwing getter then gets its key).
- Found: wrapping a frozen `SerovalError` threw `TypeError` in the `SerovalError` constructor (it sets `step` on the wrapped error). Guarded with `Object.isExtensible`.
- Found: the dev message of a step wrapper around a seroval error is built from the catalog entry with `{ cause }` only, so it reads "The value [object Undefined]..." for SRV001. Existing from errors-base, not changed here.
- Bench: load was 20+ at the start, waited for it to drop below 5 before timing.
