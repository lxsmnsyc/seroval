# Outcome: errors-plugins

## Built

- `packages/plugins/web/validate.ts`: `claim(value, tag, field)` and `copyEntries(list, tag, field)` throw `SerovalPluginValidationError(tag, field)` (SRV013). Callers in blob, file, headers, form-data, readable-stream, request and response pass their plugin tag and field.
- `packages/plugins/web/abort-signal.ts`: `AbortControllerFactoryPlugin.deserialize` throws `SerovalMalformedNodeError(node, detail)` (SRV008).
- Tests: `tests/web/shared-values.test.ts` checks `code` SRV013 and `tag` for all 7 shared cases; `tests/web/abort-signal.test.ts` checks SRV008.
- Changeset `.changeset/coded-plugin-errors.md` (seroval-plugins patch).

## Deviations

- Through `fromCrossJSON` and `fromJSON` the plugin error is wrapped in `SerovalDeserializationError`, so tests read `code` on the wrapper (copied from the inner error) and `tag` on `cause`.

## Stubs left

- None.

## Gotchas

- The `seroval` peer range stays `^1.8.0`. The classes exist since 1.8.0, but `code` only exists from 1.9.0; on 1.8.x the throws are the same classes without a code.
- `claim` now requires `tag` and `field`; a new plugin that calls it must pass them.

## Proposed learnings

- Plugins throw only `SerovalPluginValidationError` or `SerovalMalformedNodeError` | codes are catalog-only | packages/plugins/web | yes (grep for `throw new Error`)

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (265 plugin tests).
- `grep -rn 'throw new' packages/plugins/web`: only the two seroval classes.
- oxfmt on changed files; oxlint shows only warnings that pre-exist.

## Size

- Estimated S, actual S.
