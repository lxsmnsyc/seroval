import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

// https://github.com/lxsmnsyc/seroval/issues/87
//
// Same setup as seroval's keep-names.test.ts: bundle the library with
// esbuild keepNames + minify (as a hosting platform may do downstream of the
// app's own build), generate payloads inside that bundle, then evaluate AND
// consume them in a scope that only sees globals — the receiving realm never
// loaded the bundle, so any bundle-scoped helper reference throws.

const FIXTURE = `
import { crossSerializeStream, serializeAsync } from 'seroval';
import AbortSignalPlugin from '../../web/abort-signal';
import FormDataPlugin from '../../web/form-data';
import ReadableStreamPlugin from '../../web/readable-stream';

function collectAbortSignalChunks(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const chunks: string[] = [];
    crossSerializeStream(controller.signal, {
      plugins: [AbortSignalPlugin],
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
    controller.abort('aborted!');
  });
}

export async function getPayloads() {
  const stream = new ReadableStream({
    start(controller): void {
      controller.enqueue('foo');
      controller.enqueue('bar');
      controller.close();
    },
  });
  const formData = new FormData();
  formData.append('hello', 'world');
  return {
    readableStream: await serializeAsync(stream, {
      plugins: [ReadableStreamPlugin],
    }),
    formData: await serializeAsync(formData, {
      plugins: [FormDataPlugin],
    }),
    abortSignalChunks: await collectAbortSignalChunks(),
  };
}
`;

interface Payloads {
  readableStream: string;
  formData: string;
  abortSignalChunks: string[];
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
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      loader: 'ts',
    },
    // The devDependency on seroval resolves to the registry, but this suite
    // guards the workspace code — bundle against the local build (CI builds
    // all packages before running tests).
    alias: {
      seroval: fileURLToPath(
        new URL('../../../seroval/dist/index.js', import.meta.url),
      ),
    },
    bundle: true,
    keepNames: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = result.outputFiles[0].text;
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  return mod.getPayloads();
}

function evaluate<T>(payload: string): T {
  return new Function(`return (${payload})`)() as T;
}

describe('keep-names bundled payloads', () => {
  it('supports ReadableStream', async () => {
    const payloads = await getBundledPayloads();
    const back = evaluate<ReadableStream<string>>(payloads.readableStream);
    const reader = back.getReader();
    expect(await reader.read()).toMatchObject({ done: false, value: 'foo' });
    expect(await reader.read()).toMatchObject({ done: false, value: 'bar' });
    expect(await reader.read()).toMatchObject({ done: true });
  });
  it('supports FormData', async () => {
    const payloads = await getBundledPayloads();
    const back = evaluate<FormData>(payloads.formData);
    expect(back.get('hello')).toBe('world');
  });
  it('supports AbortSignal', async () => {
    const payloads = await getBundledPayloads();
    const $R: unknown[] = [];
    new Function('$R', payloads.abortSignalChunks.join(';\n'))($R);
    const back = $R[0] as AbortSignal;
    // the deserialized promise aborts the controller in a microtask
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
    expect(back.aborted).toBe(true);
    expect(back.reason).toBe('aborted!');
  });
});
