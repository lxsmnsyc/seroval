import { defineConfig } from 'tsdown';

// Each entry point is built in one pass, so `SerovalTransportError` keeps one
// identity across `@seroval/transport` and every subpath entry point.
export default defineConfig({
  entry: ['src/index.ts', 'src/read.ts', 'src/write.ts', 'src/frame.ts', 'src/web.ts', 'src/node.ts'],
  platform: 'neutral',
  target: 'es2020',
  dts: true,
  format: ['esm', 'cjs'],
});
