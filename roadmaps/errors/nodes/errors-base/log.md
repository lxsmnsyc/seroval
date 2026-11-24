# Log: errors-base

- Rebuilt `errors.ts` on the catalog; wrappers take the inner code.
- Replaced the five plain throws; the option RangeError carries SRV019.
- keep-names test forced a lazy catalog; entry-points test forced the export into `shared.ts`.
- Tests added; fast check passes.
