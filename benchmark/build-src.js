import * as esbuild from 'esbuild';

esbuild.buildSync({
  entryPoints: [
    './src/index.ts',
  ],
  outfile: './build/index.cjs',
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'cjs',
  platform: 'node',
  tsconfig: './tsconfig.json',
  target: "es2018",
  legalComments: 'eof',
  external: [
    "benny",
  ],
});
