import { defineConfig } from 'tsdown';

// Each entry point is built in one pass, so `SerovalFrameError` keeps one
// identity across `@seroval/transport`, `@seroval/transport/read` and
// `@seroval/transport/write`.
export default defineConfig({
  entry: ['src/index.ts', 'src/read.ts', 'src/write.ts'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  format: ['esm', 'cjs'],
});
