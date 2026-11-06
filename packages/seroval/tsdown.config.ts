import { defineConfig } from 'tsdown';

// Both builds keep the validators in their own module. `index` imports them
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
    entry: {
      index: 'src/index.ts',
      binary: 'src/binary/index.ts',
      validator: 'src/core/validator.ts',
    },
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
    entry: {
      index: 'src/index.ts',
      binary: 'src/binary/index.ts',
      validator: 'src/core/validator.ts',
    },
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
