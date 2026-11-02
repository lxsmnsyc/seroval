import { defineConfig } from 'vitest/config';

// Fuzzing is slow and random, so it stays out of `pnpm test` and CI.
// Run it with `pnpm fuzz`.
export default defineConfig({
  test: {
    include: ['fuzz/**/*.fuzz.ts'],
    testTimeout: 0,
  },
});
