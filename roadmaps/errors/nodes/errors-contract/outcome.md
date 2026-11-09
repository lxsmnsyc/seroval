# Outcome: errors-contract

## Built

- `packages/seroval/src/core/error-catalog.ts`: `ERROR_CODES` (name to code), `ErrorCode`, `CatalogDetails` (details type per code), `CatalogEntry`, `SerovalErrorShape` (type-only base skeleton), `SerovalErrorStep`, `LiveStreamErrorReason`, `DOCS_ERRORS_URL`, `getCatalogEntry(code)`, `getDevMessage(code, details)`, `getProdMessage(code, step?)`.
- `packages/seroval/test/errors/model.test.ts`: codes unique, well formed (`SRV` + 3 digits), one entry and unique name per code, codes strictly increasing up to SRV020 (gaps allowed, per the header comment), dev message renders, production format.
- `core/errors.ts` is untouched. Nothing imports the catalog yet.
- `LiveStreamErrorReason` is defined in the catalog too (same union as in `errors.ts`). errors-base should make `errors.ts` re-export it from the catalog.

Codes (append-only; codes after SRV020 are free for binary mode):

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
| SRV019 | `maxBase64Length` option check in `core/context/deserializer.ts` (entry name `RangeError`); stays a RangeError with `code` | value |
| SRV020 | ArrayBuffer over `maxBase64Length` in `deserializer.ts`; proposed SerovalBase64LimitError with `limit` | limit |

Production message: `Seroval SRV008 (deserialize): https://seroval.vercel.app/docs/errors/SRV008`; without a step: `Seroval SRV011: <url>`.

## Deviations

- The brief says 14 plain throws in `packages/plugins/web`; release/1.9.0 has 2 (mapped to SRV013 and SRV008, see Gotchas).
- The five seroval plain throws are no longer at the brief's line numbers; the table gives their files.

## Stubs left

- None. Classes in `core/errors.ts` still use the old model until errors-base.

## Gotchas

- `getCatalogEntry` and `getDevMessage` return `undefined` and `''` in production builds. Use them only for the dev message. Use `getProdMessage` for the prod message.
- `CatalogDetails` for SRV001, SRV005 and SRV019 hold the raw value, only for the dev message. Never copy it into a prod message.
- The docs-pages test (brief acceptance) can read `ERROR_CODES` and `getCatalogEntry(code).title` in the dev test environment.
- SRV008 details are optional so a throw site that passes a sub-field can omit `nodeType` and `nodeId`.
- `CatalogEntry.name` is the class that throws the code, or the standard class (`RangeError`) for API-misuse codes.
- The two plain plugin throws have no code of their own (maintainer decision, SRV021 dropped before release). `plugins/web/validate.ts` `claim()` maps to SRV013 `SerovalPluginValidationError(tag, field)`; `claim()` needs the tag from its callers, or they catch and rethrow with it, and errors-plugins decides how. `plugins/web/abort-signal.ts` AbortControllerFactoryPlugin.deserialize maps to SRV008 `SerovalMalformedNodeError`. There is no `createSerovalPluginError` helper.
- Maintainer to confirm: numbering order, shared SRV017, names of the three new classes.

## Proposed learnings

- New error codes go at the end of `ERROR_CODES` and `CatalogDetails`; never renumber | codes are public in docs links | packages/seroval/src/core | yes (model.test.ts gap and uniqueness checks)

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (1436 and 265 tests).
- `npx oxlint` and `npx oxfmt --check` on the two new files: clean (after the review fixes; the first version had 2 oxlint errors).
- PROD strip is also a test in `model.test.ts` (esbuild with `PROD=true`, minified, no titles, names or message text in the output). By hand: esbuild bundle of the catalog with `import.meta.env.PROD=true`, minified, is 263 bytes with no message strings; with `false` it is 4.9 kB. Existing dist is unchanged because nothing imports the catalog yet.

## Size

- Estimated M, actual S.
