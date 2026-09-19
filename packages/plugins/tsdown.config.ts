import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

const webEntry = fileURLToPath(new URL('./web', import.meta.url));

export default defineConfig([
  {
    entry: [
      'index.ts',
      {
        web: 'web/index.ts',
      },
    ],
    platform: 'neutral',
    target: 'es2020',
    dts: true,
    outDir: './dist/dev',
    format: ['esm', 'cjs'],
    inputOptions(options, format) {
      if (format === 'es') {
        options.external = ['./web'];
      }
    },
    outputOptions(options, format) {
      if (format === 'es') {
        options.paths = { [webEntry]: './web.js' };
      }
    },
    env: {
      PROD: false,
    },
  },
  {
    entry: [
      'index.ts',
      {
        web: 'web/index.ts',
      },
    ],
    platform: 'neutral',
    target: 'es2020',
    dts: true,

    format: ['esm', 'cjs'],
    inputOptions(options, format) {
      if (format === 'es') {
        options.external = ['./web'];
      }
    },
    outputOptions(options, format) {
      if (format === 'es') {
        options.paths = { [webEntry]: './web.js' };
      }
    },
    env: {
      PROD: true,
    },
  },
]);
