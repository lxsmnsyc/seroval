import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Seroval from '../src';

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL('..', import.meta.url));
type API = typeof Seroval;

afterEach(() => {
  vi.unstubAllGlobals();
});

function checkIdentity(selected: API, fallback: API): void {
  expect(Object.keys(selected).sort()).toEqual(Object.keys(fallback).sort());
  for (const key of Object.keys(selected) as (keyof API)[]) {
    expect(selected[key]).toBe(fallback[key]);
  }
  const reference = selected.createReference('package-exports', () => 42);
  expect(fallback.fromJSON(selected.toJSON(reference))).toBe(reference);
  expect(selected.fromJSON(fallback.toJSON(reference))).toBe(reference);
  expect(
    fallback.fromJSON(selected.toJSON(new fallback.OpaqueReference(1, 42))),
  ).toBe(42);
  const invalid = selected.toJSON(new ArrayBuffer(1));
  invalid.t.s = '!';
  expect(() => selected.fromJSON(invalid)).toThrow(
    fallback.SerovalDeserializationError,
  );
}

async function checkBinary(api: API): Promise<void> {
  for (const length of [0, 1, 2, 3, 381, 382, 383, 384, 385, 4096]) {
    const bytes = Uint8Array.from({ length }, (_, i) => i & 255);
    const json = api.toJSON(bytes.buffer);
    expect(json.t.s).toBe(btoa(String.fromCharCode(...bytes)));
    expect(new Uint8Array(api.fromJSON<ArrayBuffer>(json))).toEqual(bytes);
    expect(api.deserialize(api.serialize(bytes))).toEqual(bytes);
    expect(api.fromJSON(await api.toJSONAsync(bytes))).toEqual(bytes);
    expect(
      api.fromCrossJSON(api.toCrossJSON(bytes), { refs: new Map() }),
    ).toEqual(bytes);
  }
  const buffer = new ArrayBuffer(1024);
  const value = { buffer, view: new Uint8Array(buffer, 8, 16) };
  const back = api.fromJSON<typeof value>(api.toJSON(value));
  expect(back.view.buffer).toBe(back.buffer);
  expect(back.view.byteOffset).toBe(8);
  expect(back.buffer.byteLength).toBe(1024);
  const transferred = structuredClone(back, { transfer: [back.buffer] });
  expect(back.buffer.byteLength).toBe(0);
  expect(transferred.view.buffer).toBe(transferred.buffer);

  for (const source of ['YQ', ' Y\tQ==\n', ' '.repeat(512) + 'YQ==']) {
    const json = api.toJSON(new ArrayBuffer(0));
    json.t.s = source;
    expect(new Uint8Array(api.fromJSON<ArrayBuffer>(json))).toEqual(
      new Uint8Array([97]),
    );
  }
  for (const source of ['!', 'A', 'YQ=', 'YQ===', 'A'.repeat(512) + '!']) {
    const json = api.toJSON(new ArrayBuffer(0));
    json.t.s = source;
    let idReads = 0;
    Object.defineProperty(json.t, 'i', {
      get() {
        idReads++;
        throw new Error('Reference id was read before decoding');
      },
    });
    expect(() => api.fromJSON(json)).toThrow(api.SerovalDeserializationError);
    expect(idReads).toBe(0);
  }
}

describe('built package exports (run build first)', () => {
  it('does not require package imports resolution', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );
    expect(manifest.imports).toBeUndefined();
    expect(manifest.main).toBe('./dist/index.cjs');
    expect(manifest.module).toBe('./dist/index.js');
    for (const mode of ['', 'dev/']) {
      for (const extension of ['js', 'cjs']) {
        const code = await readFile(
          new URL(`../dist/${mode}index.${extension}`, import.meta.url),
          'utf8',
        );
        expect(code).not.toContain('#seroval-binary');
      }
    }
  });

  for (const development of [false, true]) {
    for (const browser of [false, true]) {
      for (const format of ['import', 'require'] as const) {
        const conditions = [
          ...(development ? ['development'] : []),
          ...(browser ? ['browser'] : []),
        ];
        const target = `dist/${development ? 'dev/' : ''}index.${format === 'import' ? 'js' : 'cjs'}`;
        const label = `${development ? 'development' : 'production'}, ${browser ? 'browser' : 'default'}, ${format}`;

        it(`resolves real package conditions in Node (${label})`, async () => {
          const load =
            format === 'import'
              ? `const selected = await import('seroval');
                 const fallback = await import('./${target}');
                 assert.equal(import.meta.resolve('seroval'), new URL('./${target}', import.meta.url).href);`
              : `const selected = require('seroval');
                 const fallback = require('./${target}');
                 assert.equal(require.resolve('seroval'), fileURLToPath(new URL('./${target}', import.meta.url)));`;
          await execFileAsync(
            process.execPath,
            [
              ...conditions.map(condition => `--conditions=${condition}`),
              '--input-type=module',
              '--eval',
              `import assert from 'node:assert/strict';
               import { createRequire } from 'node:module';
               import { fileURLToPath } from 'node:url';
               const require = createRequire(import.meta.url);
               ${load}
               for (const key of Object.keys(selected)) {
                 assert.equal(selected[key], fallback[key], key);
               }
               const ref = selected.createReference('built-package', () => 42);
               assert.equal(fallback.fromJSON(selected.toJSON(ref)), ref);
               const invalid = selected.toJSON(new ArrayBuffer(0));
               invalid.t.s = '!';
               assert.throws(() => selected.fromJSON(invalid), fallback.SerovalDeserializationError);`,
            ],
            { cwd: packageDir },
          );
        });

        it(`bundles dist without aliases and preserves identities and binary semantics (${label})`, async () => {
          const contents =
            format === 'import'
              ? `import * as selected from 'seroval';
                 import * as fallback from './${target}';
                 export { selected, fallback };`
              : `exports.selected = require('seroval');
                 exports.fallback = require('./${target}');`;
          const result = await build({
            stdin: { contents, resolveDir: packageDir },
            bundle: true,
            platform: browser ? 'browser' : 'node',
            conditions,
            format: 'cjs',
            metafile: true,
            write: false,
          });
          const inputs = Object.keys(result.metafile.inputs).map(path =>
            path.replaceAll('\\', '/'),
          );
          expect(
            inputs.filter(
              path => path === target || path.endsWith('/' + target),
            ),
          ).toHaveLength(1);
          expect(inputs.some(path => path.includes('/src/'))).toBe(false);
          expect(result.outputFiles[0].text).not.toContain('#seroval-binary');
          const { selected, fallback } = new Function(
            `const module = { exports: {} };
             const exports = module.exports;
             ${result.outputFiles[0].text}
             return module.exports;`,
          )() as { selected: API; fallback: API };
          checkIdentity(selected, fallback);
          if (browser) {
            vi.stubGlobal('Buffer', undefined);
          }
          await checkBinary(selected);
        });
      }
    }
  }
});
