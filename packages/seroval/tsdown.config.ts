import { defineConfig } from 'tsdown';

// Each entry point is built in one pass, so code that two entry points use
// goes into a shared chunk. Then `seroval`, `seroval/read`, `seroval/write`
// and `seroval/shared` load the same `Stream`, `Sequence` and error classes,
// and bundlers can split reading from writing. `validator` is an entry point
// too, so `seroval/validator` is a file of its own and every entry point
// exports the same `v`.
const entry = {
  index: 'src/index.ts',
  read: 'src/read.ts',
  write: 'src/write.ts',
  shared: 'src/shared.ts',
  validator: 'src/core/validator.ts',
};

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
