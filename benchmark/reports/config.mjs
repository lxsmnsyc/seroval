import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const protocol = {
  version: 2,
  target: 'es2020',
  format: 'esm',
  bundlerPlatform: 'browser',
  gzipLevel: 9,
  brotliQuality: 11,
  rounds: 6,
  warmups: 0,
  warmupMs: 250,
  minSampleMs: 50,
  samples: 9,
};

const core = [
  'serialize',
  'deserialize',
  'serializeAsync',
  'toJSON',
  'fromJSON',
  'toJSONAsync',
  'compileJSON',
  'crossSerialize',
  'crossSerializeAsync',
  'crossSerializeStream',
  'toCrossJSON',
  'fromCrossJSON',
  'toCrossJSONAsync',
  'toCrossJSONStream',
];
const plugins = [
  'AbortSignalPlugin',
  'BlobPlugin',
  'CustomEventPlugin',
  'DOMExceptionPlugin',
  'EventPlugin',
  'FilePlugin',
  'FormDataPlugin',
  'HeadersPlugin',
  'ImageDataPlugin',
  'ReadableStreamPlugin',
  'RequestPlugin',
  'ResponsePlugin',
  'URLPlugin',
  'URLSearchParamsPlugin',
];

export const sizeFixtures = [
  ...core.map(name => ({
    id: `core.${name}`,
    source: `export { ${name} } from 'seroval';`,
    exports: [name],
  })),
  ...plugins.map(name => ({
    id: `plugin.${name}`,
    source: `export { ${name} } from 'seroval-plugins/web';`,
    exports: [name],
  })),
  {
    id: 'plugins.web',
    source: "export * from 'seroval-plugins/web';",
    exports: plugins,
  },
  {
    id: 'pair.javascript',
    source: "export { serialize, deserialize } from 'seroval';",
    exports: ['serialize', 'deserialize'],
  },
  {
    id: 'pair.json',
    source: "export { toJSON, fromJSON } from 'seroval';",
    exports: ['toJSON', 'fromJSON'],
  },
  {
    id: 'pair.json-web',
    source: `import { toJSON, fromJSON } from 'seroval';
import * as web from 'seroval-plugins/web';
const plugins = Object.values(web);
export const encode = value => toJSON(value, { plugins });
export const decode = value => fromJSON(value, { plugins });`,
    exports: ['encode', 'decode'],
  },
];

export function publicEntry(root, specifier = 'seroval') {
  const require = createRequire(resolve(root, 'benchmark/package.json'));
  const manifestPath = require.resolve(`${specifier}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = manifest.exports['.'].import;
  assert.equal(typeof entry, 'string', 'Expected a production ESM export');
  return resolve(manifestPath, '..', entry);
}

export function harnessHash() {
  const hash = createHash('sha256');
  for (const name of ['config.mjs', 'measure.mjs', 'runtime.mjs']) {
    hash.update(readFileSync(fileURLToPath(new URL(name, import.meta.url))));
  }
  return hash.digest('hex');
}
