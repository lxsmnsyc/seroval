# Outcome: errors-malformed-detail

## Built

- Every `SerovalMalformedNodeError` throw in `deserializer.ts` (17 sites) passes a `detail`. Every `SerovalUnsupportedNodeError` throw (5 in `serializer.ts`, 3 in `deserializer.ts`) passes a `detail`.
- `SerovalUnsupportedNodeError(node, detail?)` sets `nodeId` and `detail`. SRV002 details gain `nodeId?` and `detail?`.
- Dev messages read `Malformed node 12 (type 19): source must be a string` and `Unsupported node 3 (type 9999): unknown node type`. Id, type and detail are left out when the throw site has none.
- `test/errors/malformed.test.ts`: one case per malformed site (detail, `nodeType`, `nodeId`, message), per unsupported site, and the wrapper copy.

## Deviations

- `src/core/errors.ts` and `src/core/error-catalog.ts` (errors-base and errors-contract paths): added the `detail` argument, the SRV002 details, and the shared `describeNode` message builder. Needed for the message format in the brief.
- `test/decoder-order.test.ts` asserted the old `"15"` message text; it now asserts `(type 15)`.
- The brief says 15 malformed sites; there are 17.

## Stubs left

- None.

## Gotchas

- Production messages are unchanged (`Seroval SRV008 (deserialize): <url>`).
- Sites that pass a sub-field (a key, `node.f`, `node.a[1]`) report that node's id and type, not the parent's.

## Proposed learnings

- None.

## Verification

- `pnpm --filter seroval build`, `pnpm --filter seroval test --run` (1506 pass), `pnpm --filter seroval-plugins test --run` (265 pass).
- oxlint and oxfmt on changed files: no new findings from added lines.

## Size

- Estimated M, actual M.
