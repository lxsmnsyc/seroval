import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { protocol, publicEntry } from './config.mjs';

/** @typedef {typeof import('seroval')} Seroval */
/** @typedef {import('./results.mjs').Row} Row */
/** @typedef {Pick<import('./results.mjs').Settings, 'samples' | 'warmups' | 'warmupMs' | 'minSampleMs'>} Timing */

/**
 * Only the graph value has shared references to check.
 * @typedef {object} Graph
 * @property {unknown} [self]
 * @property {object} [left]
 * @property {object} [right]
 */

/**
 * @returns {Array<[id: string, value: unknown, iterations: number]>}
 */
export function values() {
  const shared = { id: 7, text: 'shared' };
  /** @type {Graph} */
  const graph = { left: shared, right: shared };
  graph.self = graph;
  return [
    ['object.small', { id: 1, active: true, text: 'hello' }, 1000],
    [
      'object.collection',
      Array.from({ length: 1024 }, (_, id) => ({ id, text: `record-${id}` })),
      4,
    ],
    ['object.references', graph, 1000],
    ['string.short', 'a"b\\c\n', 1000],
    ['string.plain-64k', 'x'.repeat(65536), 16],
    ['string.html-64k', '<p>Text</p>\u2028'.repeat(5958), 16],
    ['binary.64', Uint8Array.from({ length: 64 }, (_, i) => i), 1000],
    ['binary.64k', Uint8Array.from({ length: 65536 }, (_, i) => i % 256), 16],
  ];
}

/**
 * @param {Graph} actual
 * @param {Graph | undefined} expected
 * @returns {void}
 */
export function verifyValue(actual, expected) {
  assert.deepStrictEqual(actual, expected);
  if (expected?.self === expected) {
    assert.equal(actual.self, actual);
    assert.equal(actual.left, actual.right);
  }
}

/**
 * @returns {AsyncGenerator<{ id: number, text: string }>}
 */
async function* chunks() {
  for (let i = 0; i < 64; i++) {
    await Promise.resolve();
    yield { id: i, text: 'stream chunk' };
  }
}

/**
 * @param {AsyncIterable<unknown>} actual
 * @returns {Promise<void>}
 */
async function verifyIterable(actual) {
  /** @type {unknown[]} */
  const restored = [];
  for await (const value of actual) {
    restored.push(value);
  }
  assert.deepStrictEqual(
    restored,
    Array.from({ length: 64 }, (_, id) => ({ id, text: 'stream chunk' })),
  );
}

/**
 * @template T
 * @param {() => T} operation
 * @param {(value: T) => void} verify
 * @param {number} iterations
 * @returns {number}
 */
function syncBatch(operation, verify, iterations) {
  const start = performance.now();
  /** @type {T | undefined} */
  let output;
  for (let i = 0; i < iterations; i++) {
    output = operation();
  }
  const elapsed = performance.now() - start;
  verify(output);
  return elapsed;
}

/**
 * @template T
 * @param {() => T} operation
 * @param {(value: T) => void} verify
 * @param {number} iterations
 * @param {Timing} settings
 * @returns {number}
 */
export function calibrateSync(operation, verify, iterations, settings) {
  assert.ok(Number.isSafeInteger(iterations) && iterations > 0, 'Invalid batch iterations');
  let elapsed = 0;
  for (;;) {
    const duration = syncBatch(operation, verify, iterations);
    elapsed += duration;
    if (duration >= settings.minSampleMs && elapsed >= settings.warmupMs) {
      return iterations;
    }
    if (duration < settings.minSampleMs) {
      iterations *= 2;
      assert.ok(iterations <= 2 ** 24, 'Sync batch calibration exceeded iteration limit');
    }
  }
}

/**
 * @template T
 * @param {() => T} operation
 * @param {(value: T) => void} verify
 * @param {number} iterations
 * @param {Timing} settings
 * @returns {number[]}
 */
export function measureSync(operation, verify, iterations, settings) {
  assert.ok(Number.isSafeInteger(iterations) && iterations > 0, 'Invalid batch iterations');
  /** @type {number[]} */
  const samples = [];
  let warmup = 0;
  for (let batch = 0; samples.length < settings.samples; batch++) {
    const elapsed = syncBatch(operation, verify, iterations);
    if (batch >= settings.warmups && warmup >= (settings.warmupMs ?? 0)) {
      samples.push(elapsed / iterations);
    } else {
      warmup += elapsed;
    }
  }
  return samples;
}

/**
 * @template I, O
 * @param {() => I} prepare
 * @param {(input: I) => Promise<O>} operation
 * @param {(output: O) => void | Promise<void>} verify
 * @param {number} iterations
 * @returns {Promise<number>}
 */
async function asyncBatch(prepare, operation, verify, iterations) {
  const inputs = Array.from({ length: iterations }, () => prepare());
  /** @type {O | undefined} */
  let output;
  const start = performance.now();
  for (const input of inputs) {
    output = await operation(input);
  }
  const elapsed = performance.now() - start;
  await verify(output);
  return elapsed;
}

/**
 * @template I, O
 * @param {() => I} prepare
 * @param {(input: I) => Promise<O>} operation
 * @param {(output: O) => void | Promise<void>} verify
 * @param {Timing} settings
 * @returns {Promise<number>}
 */
export async function calibrateAsync(prepare, operation, verify, settings) {
  let iterations = 1;
  let elapsed = 0;
  for (;;) {
    const duration = await asyncBatch(prepare, operation, verify, iterations);
    elapsed += duration;
    if (duration >= settings.minSampleMs && elapsed >= settings.warmupMs) {
      return iterations;
    }
    if (duration < settings.minSampleMs) {
      iterations *= 2;
      assert.ok(iterations <= 2 ** 20, 'Async batch calibration exceeded iteration limit');
    }
  }
}

/**
 * @template I, O
 * @param {() => I} prepare
 * @param {(input: I) => Promise<O>} operation
 * @param {(output: O) => void | Promise<void>} verify
 * @param {Timing} settings
 * @param {number} [iterations]
 * @returns {Promise<number[]>}
 */
export async function measureAsync(prepare, operation, verify, settings, iterations = 1) {
  assert.ok(Number.isSafeInteger(iterations) && iterations > 0, 'Invalid batch iterations');
  /** @type {number[]} */
  const samples = [];
  let warmup = 0;
  for (let batch = 0; samples.length < settings.samples; batch++) {
    const elapsed = await asyncBatch(prepare, operation, verify, iterations);
    if (batch >= settings.warmups && warmup >= (settings.warmupMs ?? 0)) {
      samples.push(elapsed / iterations);
    } else {
      warmup += elapsed;
    }
  }
  return samples;
}

/**
 * @param {Seroval} api
 * @param {Timing} settings
 * @returns {Promise<Row[]>}
 */
async function measureStream(api, settings) {
  /** @type {number[]} */
  const first = [];
  /** @type {number[]} */
  const total = [];
  let warmup = 0;
  for (let batch = 0; first.length < settings.samples; batch++) {
    const input = chunks();
    /** @type {import('seroval').SerovalNode[]} */
    const events = [];
    /** @type {number | undefined} */
    let firstMs;
    const start = performance.now();
    await new Promise((resolve, reject) => {
      api.toCrossJSONStream(input, {
        onParse(node) {
          firstMs ??= performance.now() - start;
          events.push(node);
        },
        onDone: resolve,
        onError: reject,
      });
    });
    const totalMs = performance.now() - start;
    assert.notEqual(firstMs, undefined, 'Stream emitted no output');
    const refs = new Map();
    /** @type {AsyncIterable<unknown>} */
    const restored = api.fromCrossJSON(events[0], { refs });
    for (const event of events.slice(1)) {
      api.fromCrossJSON(event, { refs });
    }
    await verifyIterable(restored);
    if (batch >= settings.warmups && warmup >= (settings.warmupMs ?? 0)) {
      first.push(firstMs);
      total.push(totalMs);
    } else {
      warmup += totalMs;
    }
  }
  return [
    { id: 'stream.first-output', unit: 'ms', samples: first },
    { id: 'stream.completion', unit: 'ms', samples: total },
  ];
}

/**
 * Without iterations, this calibrates and returns the iteration count.
 * @param {string} root
 * @param {string} scenario
 * @param {number} [iterations]
 * @returns {Promise<number | Row[]>}
 */
export async function runtime(root, scenario, iterations) {
  /** @type {Seroval} */
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- The public entry exports the seroval API.
  const api = await import(pathToFileURL(publicEntry(root)).href);
  if (scenario === 'object.collection.deserialize-cold') {
    const [, input] = values()[1];
    const encoded = api.serialize(input);
    const start = performance.now();
    /** @type {unknown} */
    const output = api.deserialize(encoded);
    const elapsed = performance.now() - start;
    verifyValue(output, input);
    return [
      {
        id: 'object.collection.deserialize-cold',
        unit: 'ms',
        samples: [elapsed],
      },
    ];
  }
  if (scenario === 'stream.first-output') {
    return measureStream(api, protocol);
  }
  for (const [id, input, initialIterations] of values()) {
    if (!scenario.startsWith(`${id}.`)) {
      continue;
    }
    const json = scenario === `${id}.fromJSON` ? api.toJSON(input) : undefined;
    const js = scenario === `${id}.deserialize-warm` ? api.serialize(input) : undefined;
    /** @type {Array<[name: string, operation: () => unknown, verify: (value: unknown) => void]>} */
    const operations = [
      [
        'serialize',
        () => api.serialize(input),
        (value) => {
          verifyValue(api.deserialize(value), input);
        },
      ],
      [
        'toJSON',
        () => api.toJSON(input),
        (value) => {
          verifyValue(api.fromJSON(value), input);
        },
      ],
      [
        'fromJSON',
        () => api.fromJSON(json),
        (value) => {
          verifyValue(value, input);
        },
      ],
      [
        'deserialize-warm',
        () => api.deserialize(js),
        (value) => {
          verifyValue(value, input);
        },
      ],
    ];
    for (const [name, operation, verify] of operations) {
      if (scenario !== `${id}.${name}`) {
        continue;
      }
      verify(operation());
      if (iterations === undefined) {
        return calibrateSync(operation, verify, initialIterations, protocol);
      }
      return [
        {
          id: scenario,
          unit: 'ms',
          iterations,
          samples: measureSync(operation, verify, iterations, protocol),
        },
      ];
    }
  }
  /** @type {() => unknown} */
  let prepare;
  /** @type {(input: unknown) => Promise<unknown>} */
  let operation;
  /** @type {(output: unknown) => Promise<void>} */
  let verify;
  if (scenario === 'async.promise.toJSONAsync') {
    prepare = () => ({ value: Promise.resolve({ id: 1 }) });
    // oxlint-disable-next-line typescript/promise-function-async -- An async wrapper would add work to the timed operation.
    operation = (input) => api.toJSONAsync(input);
    verify = async (output) => {
      /** @type {{ value: Promise<unknown> }} */
      const restored = api.fromJSON(output);
      verifyValue(await restored.value, { id: 1 });
    };
  } else {
    assert.equal(scenario, 'async.iterable.toJSONAsync', 'Unknown runtime scenario');
    prepare = chunks;
    // oxlint-disable-next-line typescript/promise-function-async -- An async wrapper would add work to the timed operation.
    operation = (input) => api.toJSONAsync(input);
    verify = async (output) => verifyIterable(api.fromJSON(output));
  }
  if (iterations === undefined) {
    return calibrateAsync(prepare, operation, verify, protocol);
  }
  return [
    {
      id: scenario,
      unit: 'ms',
      iterations,
      samples: await measureAsync(prepare, operation, verify, protocol, iterations),
    },
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // oxlint-disable-next-line no-console -- measure.mjs reads this JSON from stdout.
  console.log(
    JSON.stringify(
      await runtime(
        process.argv[2],
        process.argv[3],
        process.argv[4] === 'calibrate' ? undefined : Number(process.argv[4]),
      ),
    ),
  );
}
