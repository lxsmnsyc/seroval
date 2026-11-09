import { defineConfig } from 'tsdown';

// Each entry point is built in one pass, so code that two entry points use
// goes into a shared chunk. Then `seroval`, `seroval/read`, `seroval/write`
// and `seroval/shared` load the same `Stream`, `Sequence` and error classes,
// and bundlers can split reading from writing.
const entry = {
  index: 'src/index.ts',
  read: 'src/read.ts',
  write: 'src/write.ts',
  shared: 'src/shared.ts',
  validator: 'src/core/validator.ts',
};

// Both builds keep the validators in their own module. `shared` imports them
// from `./validator`, and `seroval/validator` points at that file. A plugin
// that uses `import * as v from 'seroval/validator'` then gets plain
// functions, so bundlers can still remove the plugin when it is unused.
const validatorOptions = {
  inputOptions(options: { external?: unknown }): void {
    options.external = ['./core/validator'];
  },
  outputOptions(options: { paths?: (id: string) => string }, format: string): void {
    const file = format === 'es' ? './validator.js' : './validator.cjs';
    options.paths = (id) => (/[/\\]core[/\\]validator$/.test(id) ? file : id);
  },
};

export default defineConfig([
  {
    entry,
    platform: 'neutral',
    target: 'es2020',
    dts: true,
    outDir: './dist/dev',
    format: ['esm', 'cjs'],
    ...validatorOptions,
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
    ...validatorOptions,
    env: {
      PROD: true,
    },
  },
]);
