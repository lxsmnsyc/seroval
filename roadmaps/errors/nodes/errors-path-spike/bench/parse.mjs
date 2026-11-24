// Parse-path timing for the errors-path spike.
// Usage: node parse.mjs <sync|async|stream> <collection|tree>
// Run from a folder that holds a seroval production dist (index.js).
// Prints `ms/op: <median of batch means>` for bench.py --metric.
// The dist under test is loaded by path at run time, so it has no static type.
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/promise-function-async -- untyped dynamic import of the dist under test */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(join(process.cwd(), 'index.js')).href);
const [mode, shape] = process.argv.slice(2);

function createCollection() {
  const items = [];
  for (let id = 0; id < 1024; id++) {
    items.push({ id, text: `record-${id}`, tags: ['a', 'b'], active: id % 2 === 0 });
  }
  return items;
}

// Many small containers of every kind the prototype touches, six levels deep.
function createTree(depth) {
  if (depth === 0) {
    return { leaf: true, n: depth, s: 'x' };
  }
  return {
    name: `level-${depth}`,
    list: [createTree(depth - 1), createTree(depth - 1), depth],
    map: new Map([['k', createTree(depth - 1)]]),
    set: new Set([depth, `s${depth}`]),
  };
}

function createInput() {
  return shape === 'tree' ? createTree(6) : createCollection();
}

function runStream(input) {
  return new Promise((resolve, reject) => {
    let count = 0;
    api.toCrossJSONStream(input, {
      onParse() {
        count++;
      },
      onError: reject,
      onDone() {
        resolve(count);
      },
    });
  });
}

function runOnce(input) {
  if (mode === 'sync') {
    return api.toJSON(input);
  }
  if (mode === 'async') {
    return api.toJSONAsync(input);
  }
  return runStream(input);
}

async function measureBatch(iterations) {
  // Fresh inputs so the reference map never sees a parsed value twice.
  const inputs = [];
  for (let i = 0; i < iterations; i++) {
    inputs.push(createInput());
  }
  const start = performance.now();
  for (const input of inputs) {
    const result = runOnce(input);
    if (mode !== 'sync') {
      await result;
    }
  }
  return (performance.now() - start) / iterations;
}

const iterations = shape === 'tree' ? 50 : 20;
// Warm up for about 300 ms.
const warmEnd = performance.now() + 300;
while (performance.now() < warmEnd) {
  await measureBatch(iterations);
}
const samples = [];
for (let i = 0; i < 15; i++) {
  samples.push(await measureBatch(iterations));
}
samples.sort((a, b) => a - b);
console.log(`ms/op: ${samples[Math.floor(samples.length / 2)].toFixed(5)}`);
