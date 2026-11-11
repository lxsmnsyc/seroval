/* oxlint-disable typescript/no-unsafe-type-assertion, typescript/require-await -- the generators have no await, and the tests name types the endpoint cannot see. */
import { describe, expect, it } from 'vitest';
import {
  RpcClosedError,
  RpcRemoteError,
  createChannel,
  createEndpoint,
  createRpcSignal,
} from '../../src/index';
import type { CallContext, Endpoint, EndpointOptions, RpcSignal } from '../../src/index';
import { inspectEndpoint, inspectStreaming } from '../../src/endpoint';
import { createPair, settle } from './pair';

interface Probe {
  produced: number;
  consumed: number;
  /** The most items that were produced and not consumed at once. */
  maxUnread: number;
  finished: boolean;
  /** Set when the source's `finally` ran. */
  closed: Promise<void>;
}

function createProbe(): { probe: Probe; close: () => void } {
  let close!: () => void;
  const closed = new Promise<void>((resolve) => {
    close = resolve;
  });
  return {
    probe: { produced: 0, consumed: 0, maxUnread: 0, finished: false, closed },
    close,
  };
}

interface Streams {
  count(total: number): AsyncGenerator<number>;
  fail(): AsyncGenerator<number>;
  sink(items: AsyncIterable<number>): Promise<number>;
  hold(this: CallContext): Promise<string>;
  hang(this: CallContext, items: AsyncIterable<number>): Promise<string>;
}

/** The channel as the tests call it: results are cast where they are read. */
interface StreamsChannel {
  run(name: keyof Streams, ...args: unknown[]): Promise<unknown>;
  with(options: { signal: RpcSignal }): StreamsChannel;
}

interface Setup {
  client: Endpoint;
  host: Endpoint;
  streams: StreamsChannel;
  probe: Probe;
  aborted: Promise<unknown>;
}

function setup(options: EndpointOptions = {}, clientOptions: EndpointOptions = options): Setup {
  const { probe, close } = createProbe();
  let reportAbort!: (reason: unknown) => void;
  const aborted = new Promise<unknown>((resolve) => {
    reportAbort = resolve;
  });
  const [clientPort, hostPort] = createPair();
  const host = createEndpoint(hostPort, options);
  host.serve(
    createChannel<Streams>({
      async *count(total) {
        try {
          for (let index = 0; index < total; index++) {
            probe.produced++;
            probe.maxUnread = Math.max(probe.maxUnread, probe.produced - probe.consumed);
            yield index;
          }
          probe.finished = true;
        } finally {
          close();
        }
      },
      async *fail() {
        yield 1;
        throw new TypeError('midway');
      },
      async sink(items) {
        let total = 0;
        for await (const item of items) {
          total += item;
        }
        return total;
      },
      async hang() {
        // Waits for the caller to cancel, without reading the stream.
        const { signal } = this;
        return await new Promise<string>((resolve) => {
          signal.onAbort(() => {
            resolve('stopped');
          });
        });
      },
      async hold() {
        // The signal must reach the function after an await.
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
        const { signal } = this;
        return await new Promise<string>((resolve) => {
          signal.onAbort((reason) => {
            reportAbort(reason);
            resolve('stopped');
          });
        });
      },
    }),
  );
  const client = createEndpoint(clientPort, clientOptions);
  return {
    client,
    host,
    streams: client.connect<Streams>() as unknown as StreamsChannel,
    probe,
    aborted,
  };
}

describe('the credit window', () => {
  it('holds a fast producer back while the reader does not read', async () => {
    const { streams, probe } = setup({ window: 4 });
    const items = (await streams.run('count', 1000)) as AsyncIterable<number>;
    await settle();
    // Nothing was read, so the producer stopped at the window.
    expect(probe.produced).toBe(4);
    const seen: number[] = [];
    for await (const item of items) {
      probe.consumed++;
      seen.push(item);
    }
    expect(seen).toHaveLength(1000);
    expect(seen[999]).toBe(999);
    // Never more than `window` items produced and not read.
    expect(probe.maxUnread).toBeLessThanOrEqual(4);
    expect(probe.finished).toBe(true);
  });

  it('works with a window of one', async () => {
    const { streams, probe } = setup({ window: 1 });
    const items = (await streams.run('count', 20)) as AsyncIterable<number>;
    await settle();
    expect(probe.produced).toBe(1);
    let total = 0;
    for await (const item of items) {
      probe.consumed++;
      total += item;
      expect(probe.produced - probe.consumed).toBeLessThanOrEqual(1);
    }
    expect(total).toBe(190);
  });

  it('holds back a stream that the caller sends as an argument', async () => {
    const { streams, probe } = setup({ window: 3 });
    async function* numbers(): AsyncGenerator<number> {
      for (let index = 1; index <= 50; index++) {
        probe.produced++;
        probe.maxUnread = Math.max(probe.maxUnread, probe.produced - probe.consumed);
        yield index;
        probe.consumed++;
      }
    }
    expect(await streams.run('sink', numbers())).toBe(1275);
    expect(probe.maxUnread).toBeLessThanOrEqual(3);
  });

  it('frees every key after streams end or are left', async () => {
    const { streams, client, host } = setup({ window: 4 });
    for (let round = 0; round < 25; round++) {
      const items = (await streams.run('count', 10)) as AsyncIterable<number>;
      for await (const item of items) {
        if (item === 5 && round % 2 === 0) {
          break;
        }
      }
    }
    await settle();
    for (const endpoint of [client, host]) {
      expect(inspectEndpoint(endpoint)).toMatchObject({ pending: 0, readerKeys: 0 });
      expect(inspectStreaming(endpoint)).toEqual({ running: 0, windowKeys: 0 });
    }
  });

  it('rejects a window that is not a positive integer', () => {
    const [port] = createPair();
    expect(() => createEndpoint(port, { window: 0 })).toThrow(RangeError);
    expect(() => createEndpoint(port, { window: 1.5 })).toThrow(RangeError);
  });
});

describe('leaving a stream', () => {
  it('runs the finally of the producer when the reader breaks', async () => {
    const { streams, probe } = setup({ window: 4 });
    const items = (await streams.run('count', 1000)) as AsyncIterable<number>;
    for await (const item of items) {
      if (item === 2) {
        break;
      }
    }
    await probe.closed;
    expect(probe.finished).toBe(false);
    // The producer stopped well before the end.
    expect(probe.produced).toBeLessThan(100);
  });

  it('runs the finally of the producer when the reader throws', async () => {
    const { streams, probe } = setup({ window: 4 });
    const items = (await streams.run('count', 1000)) as AsyncIterable<number>;
    await expect(
      (async () => {
        for await (const item of items) {
          if (item === 1) {
            throw new Error('reader');
          }
        }
      })(),
    ).rejects.toThrow('reader');
    await probe.closed;
    expect(probe.finished).toBe(false);
  });

  it('rejects the reader with RpcRemoteError when the stream throws midway', async () => {
    const { streams } = setup();
    const items = (await streams.run('fail')) as AsyncIterable<number>;
    const seen: number[] = [];
    let error: unknown;
    try {
      for await (const item of items) {
        seen.push(item);
      }
    } catch (thrown) {
      error = thrown;
    }
    expect(seen).toEqual([1]);
    expect(error).toBeInstanceOf(RpcRemoteError);
    expect(error).toMatchObject({ remoteName: 'TypeError', message: 'midway' });
    expect(error).not.toHaveProperty('cause');
  });

  it('fails a stream in flight with RpcClosedError when the endpoint closes', async () => {
    const { streams, client } = setup({ window: 2 });
    const items = (await streams.run('count', 1000)) as AsyncIterable<number>;
    await settle();
    client.close();
    const read = (async () => {
      for await (const item of items) {
        expect(item).toBeGreaterThanOrEqual(0);
      }
    })();
    await expect(read).rejects.toBeInstanceOf(RpcClosedError);
  });
});

describe('cancelling a call', () => {
  it('rejects run, aborts this.signal on the callee and leaves nothing behind', async () => {
    const { streams, client, host, aborted } = setup();
    const controller = createRpcSignal();
    const call = streams.with({ signal: controller.signal }).run('hold');
    // Let the call start and pass its await.
    await settle();
    expect(inspectEndpoint(client).pending).toBe(1);
    expect(inspectStreaming(host).running).toBe(1);
    const reason = new Error('stop');
    controller.abort(reason);
    await expect(call).rejects.toBe(reason);
    const seen = await aborted;
    expect(seen).toBeInstanceOf(RpcClosedError);
    await settle();
    for (const endpoint of [client, host]) {
      expect(inspectEndpoint(endpoint)).toMatchObject({ pending: 0, readerKeys: 0 });
      expect(inspectStreaming(endpoint).running).toBe(0);
    }
  });

  it('does not send a call whose signal aborted before hello', async () => {
    const { streams, client, host } = setup();
    const controller = createRpcSignal();
    const call = streams.with({ signal: controller.signal }).run('hold');
    controller.abort(new Error('early'));
    await expect(call).rejects.toThrow('early');
    await settle();
    expect(inspectEndpoint(client).pending).toBe(0);
    expect(inspectStreaming(host).running).toBe(0);
  });

  it('stops the stream of a reply that was cancelled', async () => {
    const { streams, probe, client, host } = setup({ window: 2 });
    const controller = createRpcSignal();
    const call = streams.with({ signal: controller.signal }).run('count', 1000);
    controller.abort(new Error('stop'));
    await expect(call).rejects.toThrow('stop');
    await settle();
    expect(probe.produced).toBeLessThanOrEqual(2);
    for (const endpoint of [client, host]) {
      expect(inspectEndpoint(endpoint)).toMatchObject({ pending: 0, readerKeys: 0 });
      expect(inspectStreaming(endpoint).windowKeys).toBe(0);
    }
  });
});

describe('the window of each end', () => {
  it('writes with the window the reader advertised, host window 2 and client window 16', async () => {
    const { streams, probe } = setup({ window: 2 }, { window: 16 });
    const items = (await streams.run('count', 20)) as AsyncIterable<number>;
    await settle();
    expect(probe.produced).toBe(16);
    let total = 0;
    for await (const item of items) {
      total += item;
    }
    expect(total).toBe(190);
  });

  it('writes with the window the reader advertised, host window 16 and client window 2', async () => {
    const { streams, probe } = setup({ window: 16 }, { window: 2 });
    const items = (await streams.run('count', 20)) as AsyncIterable<number>;
    await settle();
    expect(probe.produced).toBe(2);
    let total = 0;
    for await (const item of items) {
      total += item;
    }
    expect(total).toBe(190);
  });
});

describe('cancelling and closing with streams', () => {
  it('stops the argument streams of a call that was cancelled', async () => {
    const { streams, client, host } = setup({ window: 2 });
    let stopped!: () => void;
    const finallyRan = new Promise<void>((resolve) => {
      stopped = resolve;
    });
    async function* source(): AsyncGenerator<number> {
      try {
        for (let index = 0; index < 1000; index++) {
          yield index;
        }
      } finally {
        stopped();
      }
    }
    const controller = createRpcSignal();
    const call = streams.with({ signal: controller.signal }).run('hang', source());
    await settle();
    controller.abort(new Error('stop'));
    await expect(call).rejects.toThrow('stop');
    await finallyRan;
    await settle();
    for (const endpoint of [client, host]) {
      expect(inspectEndpoint(endpoint)).toMatchObject({ pending: 0, readerKeys: 0 });
      expect(inspectStreaming(endpoint)).toEqual({ running: 0, windowKeys: 0 });
    }
  });

  it('aborts the signal of a running call when the endpoint closes', async () => {
    const { streams, host, aborted } = setup();
    const call = streams.run('hold');
    call.catch(() => {});
    await settle();
    expect(inspectStreaming(host).running).toBe(1);
    host.close();
    expect(await aborted).toBeInstanceOf(RpcClosedError);
    expect(inspectStreaming(host).running).toBe(0);
  });
});
