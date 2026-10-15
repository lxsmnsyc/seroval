import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { protocol, publicEntry } from './config.mjs';

export function values() {
  const shared = { id: 7, text: 'shared' };
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

export function verifyValue(actual, expected) {
  assert.deepStrictEqual(actual, expected);
  if (expected?.self === expected) {
    assert.equal(actual.self, actual);
    assert.equal(actual.left, actual.right);
  }
}

async function* chunks() {
  for (let i = 0; i < 64; i++) {
    await Promise.resolve();
    yield { id: i, text: 'stream chunk' };
  }
}

async function verifyIterable(actual) {
  const restored = [];
  for await (const value of actual) {
    restored.push(value);
  }
  assert.deepStrictEqual(
    restored,
    Array.from({ length: 64 }, (_, id) => ({ id, text: 'stream chunk' })),
  );
}

function syncBatch(operation, verify, iterations) {
  const start = performance.now();
  let output;
  for (let i = 0; i < iterations; i++) {
    output = operation();
  }
  const elapsed = performance.now() - start;
  verify(output);
  return elapsed;
}

export function calibrateSync(operation, verify, iterations, settings) {
  assert.ok(
    Number.isSafeInteger(iterations) && iterations > 0,
    'Invalid batch iterations',
  );
  let elapsed = 0;
  for (;;) {
    const duration = syncBatch(operation, verify, iterations);
    elapsed += duration;
    if (duration >= settings.minSampleMs && elapsed >= settings.warmupMs) {
      return iterations;
    }
    if (duration < settings.minSampleMs) {
      iterations *= 2;
      assert.ok(
        iterations <= 2 ** 24,
        'Sync batch calibration exceeded iteration limit',
      );
    }
  }
}

export function measureSync(operation, verify, iterations, settings) {
  assert.ok(
    Number.isSafeInteger(iterations) && iterations > 0,
    'Invalid batch iterations',
  );
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

async function asyncBatch(prepare, operation, verify, iterations) {
  const inputs = Array.from({ length: iterations }, () => prepare());
  let output;
  const start = performance.now();
  for (const input of inputs) {
    output = await operation(input);
  }
  const elapsed = performance.now() - start;
  await verify(output);
  return elapsed;
}

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
      assert.ok(
        iterations <= 2 ** 20,
        'Async batch calibration exceeded iteration limit',
      );
    }
  }
}

export async function measureAsync(
  prepare,
  operation,
  verify,
  settings,
  iterations = 1,
) {
  assert.ok(
    Number.isSafeInteger(iterations) && iterations > 0,
    'Invalid batch iterations',
  );
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

async function measureStream(api, settings) {
  const first = [];
  const total = [];
  let warmup = 0;
  for (let batch = 0; first.length < settings.samples; batch++) {
    const input = chunks();
    const events = [];
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

export async function runtime(root, scenario, iterations) {
  const api = await import(pathToFileURL(publicEntry(root)).href);
  if (scenario === 'object.collection.deserialize-cold') {
    const [, input] = values()[1];
    const encoded = api.serialize(input);
    const start = performance.now();
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
    const js =
      scenario === `${id}.deserialize-warm` ? api.serialize(input) : undefined;
    const operations = [
      [
        'serialize',
        () => api.serialize(input),
        value => verifyValue(api.deserialize(value), input),
      ],
      [
        'toJSON',
        () => api.toJSON(input),
        value => verifyValue(api.fromJSON(value), input),
      ],
      [
        'fromJSON',
        () => api.fromJSON(json),
        value => verifyValue(value, input),
      ],
      [
        'deserialize-warm',
        () => api.deserialize(js),
        value => verifyValue(value, input),
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
  let prepare;
  let operation;
  let verify;
  if (scenario === 'async.promise.toJSONAsync') {
    prepare = () => ({ value: Promise.resolve({ id: 1 }) });
    operation = input => api.toJSONAsync(input);
    verify = async output => {
      const restored = api.fromJSON(output);
      verifyValue(await restored.value, { id: 1 });
    };
  } else {
    assert.equal(
      scenario,
      'async.iterable.toJSONAsync',
      'Unknown runtime scenario',
    );
    prepare = chunks;
    operation = input => api.toJSONAsync(input);
    verify = output => verifyIterable(api.fromJSON(output));
  }
  if (iterations === undefined) {
    return calibrateAsync(prepare, operation, verify, protocol);
  }
  return [
    {
      id: scenario,
      unit: 'ms',
      iterations,
      samples: await measureAsync(
        prepare,
        operation,
        verify,
        protocol,
        iterations,
      ),
    },
  ];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
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
