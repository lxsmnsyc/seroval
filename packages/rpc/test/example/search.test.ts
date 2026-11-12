import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import {
  RpcClosedError,
  RpcRemoteError,
  RpcTransportError,
  createChannel,
  createEndpoint,
  createRpcSignal,
} from '../../src/index';
import type { Channel, Endpoint } from '../../src/index';
import { fromNodeWorker } from '../../src/node';
import type { ProgressFunctions, SearchFunctions } from './api';

const DOCUMENTS = ['red apple pie', 'green apple tart', 'banana bread', 'apple cider'];

interface Started {
  worker: Worker;
  endpoint: Endpoint;
  search: Channel<SearchFunctions>;
}

async function waitForExit(worker: Worker): Promise<number> {
  return await new Promise((resolve) => {
    worker.once('exit', (code: number) => {
      resolve(code);
    });
  });
}

function startWorker(): Started {
  const worker = new Worker(new URL('./worker.ts', import.meta.url));
  const endpoint = createEndpoint(fromNodeWorker(worker), {});
  const search: Channel<SearchFunctions> = endpoint.connect<SearchFunctions>();
  return { worker, endpoint, search };
}

describe('package surface', () => {
  it('exports the draft API', () => {
    expect(typeof createChannel).toBe('function');
    expect(typeof createEndpoint).toBe('function');
    expect(new RpcClosedError()).toBeInstanceOf(Error);
    expect(new RpcTransportError()).toBeInstanceOf(Error);
    expect(new RpcRemoteError('TypeError', 'bad').remoteName).toBe('TypeError');
  });
});

describe('worker example', () => {
  it('runs a query on the index in the worker (rpc-endpoint)', async () => {
    const { search } = startWorker();
    // The progress channel is optional; passing one is rpc-channels.
    expect(await search.run('load', DOCUMENTS)).toBe(4);
    expect(await search.run('search', 'apple')).toEqual([
      'red apple pie',
      'green apple tart',
      'apple cider',
    ]);
    search.close();
  });

  it('sends progress back through a channel the caller passes', async () => {
    const { search } = startWorker();
    const seen: [number, number][] = [];
    const progress = createChannel({
      report(done: number, total: number) {
        seen.push([done, total]);
      },
    });
    await search.run('load', DOCUMENTS, progress);
    expect(seen).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
    search.close();
  });

  it('cancels a call and the function sees the signal', async () => {
    const { search } = startWorker();
    const controller = createRpcSignal();
    const pending = search.with({ signal: controller.signal }).run('scan', 'apple');
    // Calls start in order, so once this answers, `scan` is running.
    await search.run('search', 'apple');
    controller.abort(new Error('stop'));
    await expect(pending).rejects.toThrow('stop');
    expect(await search.run('scanWasCancelled')).toBe(true);
    search.close();
  });

  it.skip('drives a two-way generator (rpc-generators)', async () => {
    const { search } = startWorker();
    await search.run('load', DOCUMENTS, createChannel<ProgressFunctions>({ report() {} }));
    const browse = await search.run('browse', 'apple');
    expect((await browse.next()).value).toBe('red apple pie');
    // The value passed to next() reaches the worker's yield expression.
    expect((await browse.next('tart')).value).toBe('green apple tart');
    await browse.return();
    search.close();
  });

  it('closes from the caller and the worker exits', async () => {
    const { worker, search } = startWorker();
    // Listen before the close, so the exit cannot be missed.
    const exited = waitForExit(worker);
    await search.run('search', 'apple');
    search.close();
    await search.closed;
    await expect(search.run('search', 'apple')).rejects.toBeInstanceOf(RpcClosedError);
    expect(await exited).toBe(0);
  });

  it('closes from the worker and the caller sees it', async () => {
    const { worker, search } = startWorker();
    const exited = waitForExit(worker);
    search.notify('quit');
    await search.closed;
    expect(await exited).toBe(0);
  });
});
