// Build seroval, then run: node --expose-gc benchmark/stream-memory.mjs [chunks]
import process from 'node:process';
import { toCrossJSONStream } from '../packages/seroval/dist/index.js';

if (!globalThis.gc) {
  throw new Error('Run with --expose-gc');
}

const chunks = Number(process.argv[2] || 100000);
let release;
let ready;
const gate = new Promise(resolve => {
  release = resolve;
});
const reached = new Promise(resolve => {
  ready = resolve;
});

async function* source() {
  for (let i = 0; i < chunks; i++) {
    yield 0;
  }
  ready();
  await gate;
}

globalThis.gc();
const before = process.memoryUsage().heapUsed;
let emitted = 0;
const finished = new Promise((resolve, reject) => {
  toCrossJSONStream(source(), {
    onParse() {
      emitted++;
    },
    onDone: resolve,
    onError: reject,
  });
});
await reached;
globalThis.gc();
const retainedBytes = process.memoryUsage().heapUsed - before;
console.log(
  JSON.stringify({ node: process.version, chunks, emitted, retainedBytes }),
);
release();
await finished;
