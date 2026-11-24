# Log: errors-wrapper-message

- Base e4b925b7 (origin/release/1.9.0). `pnpm vitest run test/errors/wrapper-message.test.ts` in packages/seroval: 2 failed. SRV001 wrapper message was built from `{ cause }` details (value undefined); SRV003 wrapper read `tag "undefined"`.
- Fix: `resolveStepInit` passes `message: cause.message` for a wrapped seroval error. `getMessage` checks PROD first, so production messages are unchanged.
- Branch: same command, 2 passed. Fast check: seroval 1508 tests, seroval-plugins pass.
