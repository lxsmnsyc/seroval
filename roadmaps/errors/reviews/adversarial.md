# Adversarial review: errors

Fresh-context reviewer, 2026-10-31. Findings checked against the code before acting.

Accepted:

1. Constructor compatibility, public `value` and `reason` fields, and the `RangeError` tests (`test/binary.test.ts:342`, `:364`). Added rules to `error-model` and open question Q5. Renamed the new field `detail`.
2. Contract too vague: typed details per code, step assignment, the production format without a step, wrapper codes, what `node` means at sub-field sites. Added to `error-model`; errors-contract freezes the full catalog.
3. errors-docs missed `website/src/content/docs/errors.md` and `sidebar.ts`; `feat/plugin-validate` also edits `errors.ts`, `deserializer.ts`, `src/index.ts` and `errors.md`. Owned paths added; Q3 widened to the whole roadmap.
4. errors-base missed tests that match message text and the plugins snapshots. Owned paths and acceptance updated.
5. Counts: 15 malformed sites (all in `deserializer.ts`), 8 unsupported-node sites (5 serializer, 3 deserializer), 14 plugin throws. Briefs corrected; errors-malformed-detail now owns `deserializer.ts`.
6. errors-plugins needs the helper from errors-base and a built dist: hard edge added; helper signature in the contract; `src/index.ts` owned by errors-base.
7. Docs and new codes: codes are now all assigned in errors-contract, so no later node reserves one.
8. Release acceptance: changesets for both packages and the peer range; the acceptance test and grep are now owned by errors-base, limited to `packages/seroval/src`.

Rejected:

- 7 (edge kind): errors-malformed-detail stays `hard` on errors-base. Both edit `deserializer.ts`, and a hard edge is cheaper than planning a merge order.
