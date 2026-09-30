import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { protocol } from './config.mjs';
import { measure, measureRuntime } from './measure.mjs';
import {
  calibrateAsync,
  calibrateSync,
  measureAsync,
  measureSync,
} from './runtime.mjs';

const settings = {
  warmups: 0,
  warmupMs: 20,
  minSampleMs: 10,
  samples: 3,
};

test('sync calibration and timed warmup keep short operations out of tiny batches', t => {
  let time = 0;
  let work = 0;
  t.mock.method(performance, 'now', () => time);
  const operation = () => {
    time += 1;
    work++;
    return 42;
  };
  const verify = output => {
    assert.equal(output, 42);
    time += 100;
  };
  const iterations = calibrateSync(operation, verify, 1, settings);
  assert.ok(iterations >= settings.minSampleMs);
  const before = work;
  const samples = measureSync(operation, verify, iterations, settings);
  assert.deepEqual(samples, [1, 1, 1]);
  assert.ok(work - before >= settings.warmupMs + iterations * settings.samples);
});

test('async calibration batches fresh inputs and excludes preparation and validation', async t => {
  let time = 0;
  const consumed = new Set();
  t.mock.method(performance, 'now', () => time);
  const prepare = () => {
    time += 100;
    return {};
  };
  const operation = async input => {
    assert.ok(!consumed.has(input));
    consumed.add(input);
    await Promise.resolve();
    time += 1;
    return 42;
  };
  const verify = async output => {
    assert.equal(output, 42);
    await Promise.resolve();
    time += 100;
  };
  const iterations = await calibrateAsync(prepare, operation, verify, settings);
  assert.ok(iterations >= settings.minSampleMs);
  const samples = await measureAsync(
    prepare,
    operation,
    verify,
    settings,
    iterations,
  );
  assert.deepEqual(samples, [1, 1, 1]);
});

test('paired runtime uses a common calibrated batch and fresh alternating scenario processes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'seroval-runtime-pairs-'));
  const log = join(directory, 'processes.jsonl');
  const roots = {};
  try {
    for (const [side, cost] of [
      ['baseline', 0.01],
      ['candidate', 0.02],
    ]) {
      const root = join(directory, side);
      roots[side] = root;
      mkdirSync(join(root, 'benchmark'), { recursive: true });
      const pkg = join(root, 'node_modules/seroval');
      mkdirSync(pkg, { recursive: true });
      writeFileSync(join(root, 'benchmark/package.json'), '{}');
      writeFileSync(
        join(pkg, 'package.json'),
        JSON.stringify({
          type: 'module',
          exports: {
            '.': { import: './index.mjs' },
            './package.json': './package.json',
          },
        }),
      );
      writeFileSync(
        join(pkg, 'index.mjs'),
        `
import { appendFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ side: ${JSON.stringify(side)}, pid: process.pid }) + '\\n');
let time = 0;
performance.now = () => time;
export function toJSON(value) { time += ${cost}; return value; }
export function fromJSON(value) { return value; }
export function serialize(value) { return JSON.stringify(value); }
export function deserialize(value) { time += ${cost}; return JSON.parse(value); }
`,
      );
    }
    const result = measureRuntime(roots, ['object.small.toJSON']);
    const base = result.baseline[0];
    const candidate = result.candidate[0];
    assert.equal(base.iterations, candidate.iterations);
    assert.ok(base.iterations >= protocol.minSampleMs / 0.01);
    assert.equal(base.samples.length, protocol.rounds * protocol.samples);
    assert.equal(candidate.samples.length, protocol.rounds * protocol.samples);
    assert.ok(base.samples.every(value => Math.abs(value - 0.01) < 1e-9));
    assert.ok(candidate.samples.every(value => Math.abs(value - 0.02) < 1e-9));
    const processes = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    assert.equal(processes.length, 2 + protocol.rounds * 2);
    assert.equal(
      new Set(processes.map(value => value.pid)).size,
      processes.length,
    );
    assert.deepEqual(
      processes.slice(2).map(value => value.side),
      Array.from({ length: protocol.rounds }, (_, round) =>
        round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
      ).flat(),
    );
    const cold = measureRuntime({ candidate: roots.candidate }, [
      'object.collection.deserialize-cold',
    ]);
    assert.deepEqual(
      cold.candidate[0].samples,
      new Array(protocol.samples).fill(0.02),
    );
    assert.equal(cold.candidate[0].iterations, undefined);
    const single = measureRuntime({ candidate: roots.candidate }, [
      'object.small.toJSON',
    ]);
    assert.equal(
      single.candidate[0].samples.length,
      protocol.rounds * protocol.samples,
    );
    assert.equal(single.baseline, undefined);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test('scenario selection rejects unknown and empty workloads before measurement', async () => {
  for (const scenario of [[], ['not-a-scenario']]) {
    await assert.rejects(measure({ kind: 'speed', scenario }));
  }
  await assert.rejects(
    measure({ kind: 'size', scenario: ['object.small.toJSON'] }),
  );
});
