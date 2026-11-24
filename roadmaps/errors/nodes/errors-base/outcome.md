# Outcome: errors-base

## Built

- `packages/seroval/src/core/errors.ts`: every class extends `SerovalError`. The base keeps `constructor(type, cause)` and adds an optional third `init` argument that subclasses use. Fields: `name` (the class name), `code`, `step`, `path`, `nodeType`, `nodeId`, `tag`, `limit`, `detail`, and the existing `value`, `field`, `reason`, `cause`. Fields are set only when they have a value. `cause` uses the ES2022 `{ cause }` option.
- Step wrappers (`SerovalParserError`, `SerovalSerializationError`, `SerovalDeserializationError`) take the code and fields of a wrapped seroval error, or SRV014/015/016 for other errors. They set `step`, and set `step` on the wrapped seroval error when it has none. The dev message of a wrapper is still the step message that includes the inner message.
- Production message: `getProdMessage(code, step)`, `Seroval SRV008 (deserialize): <url>`; no values. Dev messages come from the catalog.
- `SerovalMalformedNodeError(node: unknown, detail?)` sets `nodeType` and `nodeId` only when `node` is a node.
- New classes: `SerovalStreamConsumedError` (SRV017, `stream.ts`, `constructors.ts`), `SerovalStreamOutputError` (SRV018, `stream-parser.ts`), `SerovalBase64LimitError(limit)` (SRV020, `deserializer.ts`).
- `deserializer.ts`: the `maxBase64Length` option check stays a `RangeError` with `code: 'SRV019'` and a catalog message. Only those two throws were touched.
- `LiveStreamErrorReason` is re-exported from the catalog.
- The catalog is exported from `shared.ts` (so from every entry point), see Deviations.
- Tests: `test/errors/base.test.ts` (names, codes, fields, wrappers, a PROD bundle for production messages), `test/errors/catalog.test.ts` (every code from SRV001 to SRV020 thrown, the no-plain-throw grep over `packages/seroval/src`, exports). Updated `live-receiver.test.ts` and `binary.test.ts`.

## Deviations

- The catalog is exported from `src/shared.ts`, not `src/index.ts`. `test/entry-points.test.ts` requires the root to equal shared plus read-only plus write-only, so a root-only export fails. Errors are already exported from `shared.ts`.
- `error-catalog.ts` (errors-contract's file) changed: the catalog is built on the first `getCatalogEntry` call, not at import. `test/keep-names.test.ts` bundles the sources with no `import.meta.env`, so the old module-level `import.meta.env.PROD` read threw. The PROD strip test still passes.
- `iterable.test.ts:213` needed no change: the wrapper message still contains the inner message. Snapshots: none changed (seroval and plugins).
- `rpc` and `transport` packages do not match on these messages; nothing adjusted.

## Stubs left

- None.

## Gotchas

- `ArrayBuffer exceeds maxBase64Length` is now `SerovalBase64LimitError` (not `RangeError`); through `fromJSON` it arrives as `cause` of `SerovalDeserializationError`, which now has `code` SRV020.
- Dev message of a wrapper around a seroval error is unchanged text (step message plus inner message); only `code`, `step` and fields come from the inner error.
- A wrapper's own production message uses the inner code. The inner error's message was built before it was wrapped, so it has no step in its production message; only its `step` field is updated.
- `pnpm install` was needed in the fresh worktree before building.
- Pre-existing oxlint errors remain in the touched source files; only lines I added were fixed.

## Proposed learnings

- Throw only classes of `core/errors.ts` from `packages/seroval/src` | the catalog test greps for plain `throw new Error(` | packages/seroval/src | yes (catalog.test.ts)

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (1471 and 265 tests).
- `npx oxlint` and `npx oxfmt` on the new and changed error files: clean for my lines.

## Size

- Estimated M, actual M.
