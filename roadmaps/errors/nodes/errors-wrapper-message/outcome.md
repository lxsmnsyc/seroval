# Outcome: errors-wrapper-message

## Built

- `packages/seroval/src/core/errors.ts`: a step wrapper around a seroval error uses the inner error's message as its development message. One line in `resolveStepInit`.
- `packages/seroval/test/errors/wrapper-message.test.ts`: SRV001 (parser and serialization wrappers) and SRV003 (deserialization wrapper).

## Proof

- base: e4b925b7, `pnpm vitest run test/errors/wrapper-message.test.ts` (in `packages/seroval`): 2 failed. SRV001 message had `[object Undefined]`, SRV003 read `tag "undefined"`.
- branch: same command: 2 passed.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- The production message of a wrapper is still built from its code and step first (`getMessage` checks `import.meta.env.PROD` before `message`), so the inner message never reaches production.
- errors-path (#347) edits the same file; this change is one added line in `resolveStepInit`.

## Proposed learnings

- None.

## Verification

- `pnpm --filter seroval build && pnpm --filter seroval test --run && pnpm --filter seroval-plugins test --run`: pass (1508 tests in seroval).
- oxfmt and oxlint on the changed files: clean.

## Size

- Estimated S, actual S.
