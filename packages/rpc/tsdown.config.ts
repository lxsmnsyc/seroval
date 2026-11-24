import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/node.ts', 'src/post-message.ts'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  format: ['esm', 'cjs'],
});
