import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// https://github.com/lxsmnsyc/seroval/issues/87
//
// Serialized constructors are derived from Function.prototype.toString() of
// functions in the running bundle. If the library was bundled with a
// name-preserving transform (esbuild --keep-names, applied by some platforms
// downstream of the app's own build), nested functions get rewritten to call
// a bundle-scoped helper, and payloads evaluated in a realm that never loaded
// that bundle throw ReferenceError.
//
// This suite bundles the library the way such a platform would
// (keepNames + minify — minify also renames the helper itself, so no global
// shim can compensate), generates payloads from inside that bundle, then
// evaluates AND consumes them in a scope that only sees globals. Consuming is
// the important part: helper calls hide inside function bodies, so a payload
// can evaluate cleanly and still be broken.

const FIXTURE = `
import { crossSerializeStream, serialize, serializeAsync } from './src';

const ASYNC_ITERABLE = {
  async *[Symbol.asyncIterator]() {
    yield 'foo';
    yield 'bar';
  },
};

function collectStream(value: unknown): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    crossSerializeStream(value, {
      onSerialize(data) {
        chunks.push(data);
      },
      onDone() {
        resolve(chunks);
      },
      onError(error) {
        reject(error);
      },
    });
  });
}

export async function getPayloads() {
  return {
    iterable: serialize({
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
        yield 3;
      },
    }),
    asyncIterable: await serializeAsync(ASYNC_ITERABLE),
    promise: await serializeAsync(Promise.resolve('resolved')),
    streamChunks: await collectStream(ASYNC_ITERABLE),
  };
}
`;

interface Payloads {
  iterable: string;
  asyncIterable: string;
  promise: string;
  streamChunks: string[];
}

let cached: Promise<Payloads> | undefined;

function getBundledPayloads(): Promise<Payloads> {
  cached ||= bundleAndRun();
  return cached;
}

async function bundleAndRun(): Promise<Payloads> {
  const result = await build({
    stdin: {
      contents: FIXTURE,
      resolveDir: fileURLToPath(new URL('..', import.meta.url)),
      loader: 'ts',
    },
    bundle: true,
    keepNames: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = result.outputFiles[0].text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return mod.getPayloads();
}

// Function bodies only see globals — same visibility as a payload evaluated
// in a browser that never loaded the server bundle.
function evaluate<T>(payload: string): T {
  // oxlint-disable-next-line no-new-func
  return new Function(`return (${payload})`)() as T;
}

async function drain<T>(value: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of value) {
    items.push(item);
  }
  return items;
}

describe('keep-names bundled payloads', () => {
  it('supports Iterables', async () => {
    const payloads = await getBundledPayloads();
    const back = evaluate<Iterable<number>>(payloads.iterable);
    expect([...back]).toEqual([1, 2, 3]);
  });
  it('supports AsyncIterables', async () => {
    const payloads = await getBundledPayloads();
    const back = evaluate<AsyncIterable<string>>(payloads.asyncIterable);
    expect(await drain(back)).toEqual(['foo', 'bar']);
  });
  it('supports Promises', async () => {
    const payloads = await getBundledPayloads();
    const back = evaluate<Promise<string>>(payloads.promise);
    await expect(back).resolves.toBe('resolved');
  });
  it('supports crossSerializeStream', async () => {
    const payloads = await getBundledPayloads();
    const $R: unknown[] = [];
    // oxlint-disable-next-line no-new-func
    new Function('$R', payloads.streamChunks.join(';\n'))($R);
    const back = $R[0] as AsyncIterable<string>;
    expect(await drain(back)).toEqual(['foo', 'bar']);
  });
});
