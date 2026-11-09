# Log: errors-contract

- Plain throws found on release/1.9.0: seroval has 5 (`core/stream.ts` and `core/constructors.ts` "Stream consumed", `stream-parser.ts` output callback, `deserializer.ts` maxBase64Length RangeError and ArrayBuffer RangeError). `packages/plugins/web` has 2, not 14 (`validate.ts` claim, `abort-signal.ts` factory deserialize). The brief's 14 is out of date.
- Numbering: SRV001-SRV013 keep the old `specific` numbers, so old and new numbers line up. SRV014-016 are the generic step codes, then plain throws, then plugin.
- Decision for the maintainer: the two stream-consumed throws share SRV017 (same condition, two places).
- Decision for the maintainer: both plugin throws share one code SRV021, told apart by `expected`. Splitting them later costs only a new code.
- Decision for the maintainer: names for the new classes (SerovalStreamConsumedError, SerovalStreamOutputError, SerovalBase64LimitError) are proposals.
- Catalog layout: `ERROR_CODES` (kept in prod, tiny), the entries and messages live in `createCatalog()` behind `import.meta.env.PROD`. Prod bundle of the catalog is 263 bytes with no message strings; dev is 4.9 kB.
- Type-only base skeleton is `SerovalErrorShape` in error-catalog.ts. `core/errors.ts` is untouched.
- Prod format helper `getProdMessage(code, step?)` and `DOCS_ERRORS_URL` are in the catalog, so errors-base only calls them.
- Dead end: tsc could not run in the worktree without node_modules; ran `pnpm install --frozen-lockfile`. Type check comes from the build and vitest.
