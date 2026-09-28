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

export function measureSync(operation, verify, iterations, settings) {
  const samples = [];
  let output;
  for (let batch = 0; batch < settings.warmups + settings.samples; batch++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      output = operation();
    }
    const elapsed = (performance.now() - start) / iterations;
    verify(output);
    if (batch >= settings.warmups) {
      samples.push(elapsed);
    }
  }
  return samples;
}

export async function measureAsync(prepare, operation, verify, settings) {
  const samples = [];
  for (let batch = 0; batch < settings.warmups + settings.samples; batch++) {
    const input = prepare();
    const start = performance.now();
    const output = await operation(input);
    const elapsed = performance.now() - start;
    await verify(output);
    if (batch >= settings.warmups) {
      samples.push(elapsed);
    }
  }
  return samples;
}

async function measureStream(api, settings) {
  const first = [];
  const total = [];
  for (let batch = 0; batch < settings.warmups + settings.samples; batch++) {
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
    if (batch >= settings.warmups) {
      first.push(firstMs);
      total.push(totalMs);
    }
  }
  return [
    { id: 'stream.first-output', unit: 'ms', samples: first },
    { id: 'stream.completion', unit: 'ms', samples: total },
  ];
}

export async function runtime(root, cold = false) {
  const api = await import(pathToFileURL(publicEntry(root)).href);
  if (cold) {
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
  const results = [];
  for (const [id, input, iterations] of values()) {
    const json = api.toJSON(input);
    const js = api.serialize(input);
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
      verify(operation());
      results.push({
        id: `${id}.${name}`,
        unit: 'ms',
        samples: measureSync(operation, verify, iterations, protocol),
      });
    }
  }
  results.push({
    id: 'async.promise.toJSONAsync',
    unit: 'ms',
    samples: await measureAsync(
      () => ({ value: Promise.resolve({ id: 1 }) }),
      input => api.toJSONAsync(input),
      async output => {
        const restored = api.fromJSON(output);
        verifyValue(await restored.value, { id: 1 });
      },
      protocol,
    ),
  });
  results.push({
    id: 'async.iterable.toJSONAsync',
    unit: 'ms',
    samples: await measureAsync(
      chunks,
      input => api.toJSONAsync(input),
      output => verifyIterable(api.fromJSON(output)),
      protocol,
    ),
  });
  results.push(...(await measureStream(api, protocol)));
  return results;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(
    JSON.stringify(await runtime(process.argv[2], process.argv[3] === 'cold')),
  );
}
