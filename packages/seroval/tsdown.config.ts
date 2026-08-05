import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts', { binary: 'src/binary/index.ts' }],
    platform: 'neutral',
    dts: true,
    outDir: './dist/dev',
    format: ['esm', 'cjs'],
    env: {
      PROD: false,
    },
  },
  {
    entry: ['src/index.ts', { binary: 'src/binary/index.ts' }],
    platform: 'neutral',
    dts: true,

    format: ['esm', 'cjs'],
    env: {
      PROD: true,
    },
  },
]);
