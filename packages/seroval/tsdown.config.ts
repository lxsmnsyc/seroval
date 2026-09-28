import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

const validatorEntry = fileURLToPath(
  new URL('./src/core/validator', import.meta.url),
);

export default defineConfig([
  {
    entry: ['src/index.ts', { validator: 'src/core/validator.ts' }],
    platform: 'neutral',
    dts: true,
    outDir: './dist/dev',
    format: ['esm', 'cjs'],
    inputOptions(options, format) {
      if (format === 'es') {
        options.external = ['./core/validator'];
      }
    },
    outputOptions(options, format) {
      if (format === 'es') {
        options.paths = { [validatorEntry]: './validator.js' };
      }
    },
    env: {
      PROD: false,
    },
  },
  {
    entry: ['src/index.ts', { validator: 'src/core/validator.ts' }],
    platform: 'neutral',
    dts: true,

    format: ['esm', 'cjs'],
    inputOptions(options, format) {
      if (format === 'es') {
        options.external = ['./core/validator'];
      }
    },
    outputOptions(options, format) {
      if (format === 'es') {
        options.paths = { [validatorEntry]: './validator.js' };
      }
    },
    env: {
      PROD: true,
    },
  },
]);
