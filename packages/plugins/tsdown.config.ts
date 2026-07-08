import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    web: 'web/index.ts',
  },
  platform: 'neutral',
  dts: true,
  exports: true,
});
