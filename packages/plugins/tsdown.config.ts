import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'index.ts',
    {
      web: 'web/index.ts',
    },
  ],
  platform: 'neutral',
  dts: true,
  exports: true,
});
