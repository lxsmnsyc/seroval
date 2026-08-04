import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: [
      'index.ts',
      {
        web: 'web/index.ts',
      },
    ],
    platform: 'neutral',
    dts: true,
    outDir: './dist/dev',
    format: ['esm', 'cjs'],
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
    dts: true,

    format: ['esm', 'cjs'],
    env: {
      PROD: true,
    },
  },
]);
