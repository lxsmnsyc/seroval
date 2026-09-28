import { defineConfig } from 'tsdown';

const entry = {
  index: 'src/index.ts',
  'binary-browser': 'src/core/binary-browser.ts',
  'binary-neutral': 'src/core/binary-neutral.ts',
};

// Keep the package import in emitted files so consumers select the helper
// through the `imports` conditions in package.json.
const deps = { neverBundle: ['#seroval-binary'] };

export default defineConfig([
  {
    entry,
    deps,
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
    entry,
    deps,
    platform: 'neutral',
    target: 'es2020',
    dts: true,

    format: ['esm', 'cjs'],
    env: {
      PROD: true,
    },
  },
]);
