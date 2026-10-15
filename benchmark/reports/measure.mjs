import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build, version as esbuildVersion, formatMessagesSync } from 'esbuild';
import { harnessHash, protocol, sizeFixtures } from './config.mjs';
import { speedIds, validateReport } from './results.mjs';

function revision(root) {
  return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
}

function lockHash(root) {
  return createHash('sha256')
    .update(readFileSync(resolve(root, 'pnpm-lock.yaml')))
    .digest('hex');
}

export async function measureSize(root) {
  const rows = [];
  const attribution = {};
  const warnings = new Set();
  for (const fixture of sizeFixtures) {
    const result = await build({
      stdin: {
        contents: fixture.source,
        resolveDir: resolve(root, 'benchmark'),
        sourcefile: 'fixture.js',
      },
      absWorkingDir: root,
      bundle: true,
      minify: true,
      write: false,
      metafile: true,
      sourcemap: false,
      legalComments: 'none',
      format: protocol.format,
      platform: protocol.bundlerPlatform,
      target: protocol.target,
      conditions: ['production'],
      logLevel: 'silent',
    });
    for (const warning of result.warnings) {
      const message = formatMessagesSync([warning], {
        kind: 'warning',
        color: false,
      }).join('\n');
      if (!warnings.has(message)) {
        console.log(message);
        warnings.add(message);
      }
    }
    assert.equal(result.outputFiles.length, 1, 'Expected one unsplit fixture');
    const output = result.outputFiles[0].contents;
    const metadata = Object.values(result.metafile.outputs)[0];
    assert.deepStrictEqual(
      [...metadata.exports].sort(),
      [...fixture.exports].sort(),
      fixture.id,
    );
    assert.ok(
      Object.values(metadata.inputs).some(input => input.bytesInOutput > 0),
      'Empty fixture',
    );
    rows.push({
      id: fixture.id,
      unit: 'bytes',
      raw: output.length,
      gzip: gzipSync(output, { level: protocol.gzipLevel }).length,
      brotli: brotliCompressSync(output, {
        params: { [constants.BROTLI_PARAM_QUALITY]: protocol.brotliQuality },
      }).length,
    });
    attribution[fixture.id] = result.metafile;
  }
  return { rows, attribution };
}

function runtimePass(root, scenario, iterations) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL('runtime.mjs', import.meta.url)),
        root,
        scenario,
        iterations === undefined ? 'calibrate' : String(iterations),
      ],
      { encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 },
    ),
  );
}

export function measureRuntime(roots, scenarios = speedIds) {
  const result = Object.fromEntries(Object.keys(roots).map(side => [side, []]));
  const sides = roots.baseline ? ['baseline', 'candidate'] : ['candidate'];
  for (const scenario of scenarios) {
    if (scenario === 'stream.completion') {
      continue;
    }
    const cold = scenario.endsWith('-cold');
    const latency = cold || scenario === 'stream.first-output';
    const iterations = latency
      ? 1
      : Math.max(...sides.map(side => runtimePass(roots[side], scenario)));
    assert.ok(
      Number.isSafeInteger(iterations) && iterations > 0,
      'Invalid calibrated iterations',
    );
    for (
      let round = 0;
      round < (cold ? protocol.samples : protocol.rounds);
      round++
    ) {
      const order = round % 2 ? [...sides].reverse() : sides;
      for (const side of order) {
        const rows = runtimePass(roots[side], scenario, iterations);
        for (const row of rows) {
          const previous = result[side].find(item => item.id === row.id);
          if (previous) {
            previous.samples.push(...row.samples);
          } else {
            result[side].push(row);
          }
        }
      }
    }
  }
  return result;
}

export async function measure({ candidate, baseline, kind, output, scenario }) {
  assert.ok(!scenario || kind === 'speed', '--scenario requires --kind speed');
  if (scenario) {
    assert.ok(
      scenario.length > 0 && scenario.every(id => speedIds.includes(id)),
      'Unknown runtime scenario',
    );
  }
  const selected = new Set(scenario ?? speedIds);
  if (
    selected.has('stream.first-output') ||
    selected.has('stream.completion')
  ) {
    selected.add('stream.first-output');
    selected.add('stream.completion');
  }
  const roots = { candidate: resolve(candidate) };
  if (baseline) {
    roots.baseline = resolve(baseline);
  }
  const settings = {
    ...protocol,
    scenarios:
      kind === 'size'
        ? sizeFixtures.map(fixture => fixture.id)
        : speedIds.filter(id => selected.has(id)),
    harness: harnessHash(),
    esbuild: esbuildVersion,
    node: process.version,
    v8: process.versions.v8,
    zlib: process.versions.zlib,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model ?? 'unknown',
  };
  const report = {
    schemaVersion: 1,
    kind,
    measuredAt: new Date().toISOString(),
    settings,
    candidate: {
      revision: revision(roots.candidate),
      lockHash: lockHash(roots.candidate),
      rows: [],
    },
    baseline: baseline
      ? {
          revision: revision(roots.baseline),
          lockHash: lockHash(roots.baseline),
          rows: [],
        }
      : null,
  };
  mkdirSync(output, { recursive: true });
  if (kind === 'size') {
    for (const [side, root] of Object.entries(roots)) {
      const result = await measureSize(root);
      report[side].rows = result.rows;
      writeFileSync(
        resolve(output, `size-${side}-attribution.json`),
        JSON.stringify(result.attribution, null, 2),
      );
    }
  } else {
    const rows = measureRuntime(roots, settings.scenarios);
    for (const side of Object.keys(roots)) {
      report[side].rows = rows[side];
    }
  }
  validateReport(report);
  const destination = resolve(output, `${kind}.json`);
  writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
  console.log(destination);
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { values } = parseArgs({
    options: {
      candidate: {
        type: 'string',
        default: resolve(import.meta.dirname, '../..'),
      },
      baseline: { type: 'string' },
      kind: { type: 'string' },
      scenario: { type: 'string', multiple: true },
      output: {
        type: 'string',
        default: resolve(import.meta.dirname, '../results/reports'),
      },
    },
  });
  assert.ok(
    ['size', 'speed'].includes(values.kind),
    '--kind must be size or speed',
  );
  await measure(values);
}
