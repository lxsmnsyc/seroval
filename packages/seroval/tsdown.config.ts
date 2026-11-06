import { defineConfig } from 'tsdown';

// Each entry point is built in one pass, so code that two entry points use
// goes into a shared chunk. Then `seroval`, `seroval/read`, `seroval/write`
// and `seroval/shared` load the same `Stream`, `Sequence` and error classes,
// and bundlers can split reading from writing.
const entry = ['src/index.ts', 'src/read.ts', 'src/write.ts', 'src/shared.ts'];

export default defineConfig([
  {
    entry,
    platform: 'neutral',
    target: 'es2020',
    dts: true,
    outDir: './dist/dev',
    format: ['esm', 'cjs'],
    env: {
      PROD: false,
    },
  },
  {
    entry,
    platform: 'neutral',
    target: 'es2020',
    dts: true,

    format: ['esm', 'cjs'],
    env: {
      PROD: true,
    },
  },
]);
