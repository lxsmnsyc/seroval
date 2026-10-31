---
milestones: [seroval-1.9, seroval-2.0]
run: parallel
review: auto
merge:
  mode: maintainer
branches:
budget:
release:
  publish: changesets
  paths: [packages/seroval/**, packages/plugins/**]
  fence: merge
---

# Better seroval errors

## Outcome

Every error seroval and seroval-plugins throw is a `SerovalError` with its own `name`, a stable string `code` from one catalog, and structured fields (`step`, and where they apply `path`, `nodeType`, `nodeId`, `tag`, `limit`, `detail`). Development messages say what was wrong and where. Production messages are one line with the code, the step and a link to a docs page for that code, and leak no values. Existing `instanceof` checks keep working.

## Acceptance

- `pnpm --filter seroval test` and `pnpm --filter seroval-plugins test` pass.
- A test in `packages/seroval/test/errors/` throws every catalog code at least once and checks `name`, `code` and the production message format.
- No `throw new Error(` or `throw new TypeError(` remains in `packages/seroval/src` (grep in `catalog.test.ts`; the option check at `deserializer.ts:117` stays a `RangeError` with a `code`, per Q5). `packages/plugins/web` follows when errors-plugins lands.
- Every catalog code has a docs page, checked by a test that compares the catalog with the pages.

## Priorities

- must: needed for the seroval-1.9 minor release: the base class, the catalog, names, codes, one production format, no plain throws in seroval, malformed-node detail, and the docs pages production messages link to.
- should: worth shipping, in 1.9 or a later minor (value paths, plugin errors). No milestone, so the release does not wait for them.
- could: when agents are free.
- later: seroval-2.0 (removing deprecated exports).

## Constraints

- Every exported error class stays exported with the same constructor arguments, and `instanceof` keeps working.
- Production builds strip development messages through `import.meta.env.PROD`, as now. Production messages never contain user values.
- No measurable slowdown on the success path. Path tracking must only cost on throw, proven with the perf-pass skill.
- Codes are never reused or renumbered once released.

## Non-goals

- Translating messages.
- Changing what seroval accepts or rejects. Only how it reports.
- Errors in `@seroval/rpc` (its own roadmap adopts the catalog later).

## Verification

- Fast check (safe in parallel worktrees): `pnpm --filter seroval build && pnpm --filter seroval test && pnpm --filter seroval-plugins test`
- Full check (checkpoints): `pnpm -r build && pnpm -r test`

## Numbered resources

- Error codes in `packages/seroval/src/core/error-catalog.ts`. errors-contract assigns every code this roadmap needs; no other node adds one.

## Sources

- `packages/seroval/src/core/errors.ts` at main 6820fd9f.
- brumate `packages/brumate/src/error.ts` and `error-catalog.ts` (catalog with `[BRM012]` codes).

## Open questions

- Q1, answered 2026-10-31: `SRV` plus three digits (`SRV008`), matching brumate's `BRM012`.
- Q2, answered: rewrite `website/src/content/docs/errors.md` as the index, and add one page per code at `docs/errors/<code>`, served at `seroval.vercel.app/docs/errors/<code>`.
- Q3, answered: merge `feat/plugin-validate` before wave 2 (blocks errors-base, errors-malformed-detail, errors-plugins, errors-docs). That branch edits `errors.ts`, `deserializer.ts`, `src/index.ts` and `website/src/content/docs/errors.md`, and requires seroval 1.8.0 in seroval-plugins. errors-contract can run meanwhile.
- Q4, answered: minor release, with the changed names and messages called out in the changeset.
- Q5, answered: errors caused by the data are seroval errors; errors caused by how the API is called stay standard JavaScript errors with a `code` added. So `ArrayBuffer exceeds maxBase64Length` (`deserializer.ts:418`) becomes a coded seroval limit error with `limit`, like `SerovalDepthLimitError`; it already reaches users wrapped in `SerovalDeserializationError`, so only `cause instanceof RangeError` breaks. `maxBase64Length must be a non-negative safe integer` (`deserializer.ts:117`) stays a `RangeError` with a `code`.
- Q6, answered 2026-10-31: seroval 1.8.0 ships `feat/split-entry-points` and `feat/plugin-validate` (which already requires 1.8.0 in seroval-plugins). This roadmap releases as 1.9.0.

## Gates

- errors-contract: the catalog, code format and production message are reviewed before the classes change.
- errors-path-spike: the measured cost decides whether errors-path goes ahead.
- errors-release-1.9.
