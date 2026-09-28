import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The package.json mapping targets emitted files; tests use the source.
      '#seroval-binary': fileURLToPath(
        new URL('./src/core/binary-neutral.ts', import.meta.url),
      ),
    },
  },
});
