# Outcome: errors-contract

## Built

- `packages/seroval/src/core/error-catalog.ts`: `ERROR_CODES` (name to code), `ErrorCode`, `CatalogDetails` (details type per code), `CatalogEntry`, `SerovalErrorShape` (type-only base skeleton), `SerovalErrorStep`, `LiveStreamErrorReason`, `DOCS_ERRORS_URL`, `getCatalogEntry(code)`, `getDevMessage(code, details)`, `getProdMessage(code, step?)`.
- `packages/seroval/test/errors/model.test.ts`: codes unique, well formed (`SRV` + 3 digits), no gaps, one entry and unique name per code, dev message renders, production format.
- `core/errors.ts` is untouched. Nothing imports the catalog yet.
- `LiveStreamErrorReason` is defined in the catalog too (same union as in `errors.ts`). errors-base should make `errors.ts` re-export it from the catalog.

Codes (append-only; codes after SRV021 are free for binary mode):

| Code | Class or throw site | Details |
| --- | --- | --- |
| SRV001 | SerovalUnsupportedTypeError | value |
| SRV002 | SerovalUnsupportedNodeError | nodeType |
| SRV003 | SerovalMissingPluginError | tag |
| SRV004 | SerovalMissingInstanceError | tag |
| SRV005 | SerovalMissingReferenceError (deprecated) | value |
| SRV006 | SerovalMissingReferenceForIdError | id |
| SRV007 | SerovalUnknownTypedArrayError | name |
| SRV008 | SerovalMalformedNodeError | nodeType?, nodeId?, detail? |
| SRV009 | SerovalConflictedNodeIdError | nodeId |
| SRV010 | SerovalDepthLimitError | limit |
| SRV011 | SerovalAbortedError | none |
| SRV012 | SerovalLiveStreamError | reason |
| SRV013 | SerovalPluginValidationError | tag, field |
| SRV014 | SerovalParserError (generic, parse step) | cause |
| SRV015 | SerovalSerializationError (generic, serialize step) | cause |
| SRV016 | SerovalDeserializationError (generic, deserialize step) | cause |
| SRV017 | "Stream consumed" in `core/stream.ts` and `core/constructors.ts`; proposed class SerovalStreamConsumedError | none |
| SRV018 | "Stream output callback is unavailable" in `core/context/stream-parser.ts`; proposed SerovalStreamOutputError | none |
| SRV019 | `maxBase64Length` option check in `core/context/deserializer.ts`; stays a RangeError with `code` | value |
| SRV020 | ArrayBuffer over `maxBase64Length` in `deserializer.ts`; proposed SerovalBase64LimitError with `limit` | limit |
| SRV021 | Plugin errors via `createSerovalPluginError(tag, expected)`: `plugins/web/validate.ts` claim and `plugins/web/abort-signal.ts` factory deserialize | tag, expected |

Production message: `Seroval SRV008 (deserialize): https://seroval.vercel.app/docs/errors/SRV008`; without a step: `Seroval SRV011: <url>`.

## Deviations

- The brief says 14 plain throws in `packages/plugins/web`; release/1.9.0 has 2 (both under SRV021).
- The five seroval plain throws are no longer at the brief's line numbers; the table gives their files.

## Stubs left

- None. Classes in `core/errors.ts` still use the old model until errors-base.

## Gotchas

- `getCatalogEntry` and `getDevMessage` return `undefined` and `''` in production builds. Use them only for the dev message. Use `getProdMessage` for the prod message.
- `CatalogDetails` for SRV001, SRV005 and SRV019 hold the raw value, only for the dev message. Never copy it into a prod message.
- The docs-pages test (brief acceptance) can read `ERROR_CODES` and `getCatalogEntry(code).title` in the dev test environment.
- SRV008 details are optional so a throw site that passes a sub-field can omit `nodeType` and `nodeId`.
- Maintainer to confirm: numbering order, shared SRV017 and SRV021, names of the three new classes.

## Proposed learnings

- New error codes go at the end of `ERROR_CODES` and `CatalogDetails`; never renumber | codes are public in docs links | packages/seroval/src/core | yes (model.test.ts gap and uniqueness checks)

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (1435 and 265 tests).
- `npx oxlint` and `npx oxfmt` on the two new files: clean.
- PROD strip: esbuild bundle of the catalog with `import.meta.env.PROD=true`, minified, is 263 bytes with no message strings; with `false` it is 4.9 kB. Existing dist is unchanged because nothing imports the catalog yet.

## Size

- Estimated M, actual S.
