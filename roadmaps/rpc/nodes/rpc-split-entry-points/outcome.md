# Outcome: rpc-split-entry-points

## Built

- Already fulfilled by seroval 1.8.0. `packages/seroval/package.json` on main exports `./write` and `./read`, and `@seroval/transport` imports them.

## Deviations

- None.

## Verification

- `git show origin/main:packages/seroval/package.json` lists `"./write"` and `"./read"`.
