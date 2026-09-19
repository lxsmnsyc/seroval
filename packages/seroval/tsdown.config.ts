import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: 'src/index.ts',
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
    entry: 'src/index.ts',
    platform: 'neutral',
    target: 'es2020',
    dts: true,

    format: ['esm', 'cjs'],
    env: {
      PROD: true,
    },
  },
]);
