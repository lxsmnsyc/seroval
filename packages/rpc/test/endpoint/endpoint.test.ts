/* oxlint-disable typescript/no-unsafe-type-assertion -- the tests call names the types forbid. */
import { MessageChannel } from 'node:worker_threads';
import { createReference } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import {
  RpcClosedError,
  RpcRemoteError,
  RpcTransportError,
  createChannel,
  createEndpoint,
} from '../../src/index';
import type { CallContext, Channel, ChannelOptions, Endpoint, Port } from '../../src/index';
import { inspectEndpoint } from '../../src/endpoint';
import { fromNodeWorker } from '../../src/node';
import { fromMessagePort } from '../../src/post-message';

type Listener = (message: unknown) => void;

/** Two ports wired to each other. `sync` delivers inside `send`. */
function createPair(sync = false): [Port, Port] {
  const listeners: [Set<Listener>, Set<Listener>] = [new Set(), new Set()];
  const backlog: [unknown[], unknown[]] = [[], []];
  function makePort(self: 0 | 1): Port {
    return {
      send(message) {
        const other = listeners[self === 0 ? 1 : 0];
        // Messages are copied, like postMessage does.
        const copy = structuredClone(message);
        function deliver(): void {
          // Like a MessagePort, hold messages until someone listens.
          if (other.size === 0) {
            backlog[self === 0 ? 1 : 0].push(copy);
          }
          for (const listener of [...other]) {
            listener(copy);
          }
        }
        if (sync) {
          deliver();
        } else {
          queueMicrotask(deliver);
        }
      },
      onMessage(listener) {
        listeners[self].add(listener);
        for (const message of backlog[self].splice(0)) {
          listener(message);
        }
        return () => {
          listeners[self].delete(listener);
        };
      },
    };
  }
  return [makePort(0), makePort(1)];
}

interface MathFunctions {
  add(a: number, b: number): number;
  fail(message: string): never;
  echo(value: unknown): unknown;
  slow(ms: number): Promise<string>;
  whoami(this: CallContext): boolean;
  hear(value: string): void;
}

function createMath(heard: string[] = [], options?: ChannelOptions): Channel<MathFunctions> {
  return createChannel<MathFunctions>(
    {
      add: (a, b) => a + b,
      fail(message) {
        throw new TypeError(message);
      },
      echo: (value) => value,
      slow: async (ms) => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        });
        return 'done';
      },
      whoami() {
        return typeof this.channel.close === 'function';
      },
      hear(value) {
        heard.push(value);
      },
    },
    options,
  );
}

function connectPair(
  ports: [Port, Port],
  server: Channel<MathFunctions>,
): { client: Endpoint; host: Endpoint; math: Channel<MathFunctions> } {
  const host = createEndpoint(ports[1], {});
  host.serve(server);
  const client = createEndpoint(ports[0], {});
  return { client, host, math: client.connect<MathFunctions>() };
}

describe.each([false, true])('in-memory pair (sync delivery: %s)', (sync) => {
  it('runs value calls and returns results', async () => {
    const { math } = connectPair(createPair(sync), createMath());
    expect(await math.run('add', 1, 2)).toBe(3);
    expect(await math.run('echo', { a: [1, 'x', null], b: new Map([[1, 2]]) })).toEqual({
      a: [1, 'x', null],
      b: new Map([[1, 2]]),
    });
  });

  it('calls in both directions', async () => {
    const ports = createPair(sync);
    const { client, host, math } = connectPair(ports, createMath());
    client.serve(createMath());
    const back = host.connect<MathFunctions>();
    expect(await Promise.all([math.run('add', 1, 1), back.run('add', 2, 2)])).toEqual([2, 4]);
  });

  it('starts calls in the order they were made, including before hello', async () => {
    const heard: string[] = [];
    const { math } = connectPair(createPair(sync), createMath(heard));
    math.notify('hear', 'a');
    const second = math.run('hear', 'b');
    math.notify('hear', 'c');
    await second;
    expect(heard).toEqual(['a', 'b', 'c']);
  });

  it('delivers notify without a result', async () => {
    const heard: string[] = [];
    const { math } = connectPair(createPair(sync), createMath(heard));
    math.notify('hear', 'x');
    await math.run('add', 0, 0);
    expect(heard).toEqual(['x']);
  });

  it('rejects with RpcRemoteError holding only name and message', async () => {
    const { math } = connectPair(createPair(sync), createMath());
    const error = await math.run('fail', 'boom').catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(RpcRemoteError);
    expect(error).toMatchObject({ remoteName: 'TypeError', message: 'boom' });
    expect(error).not.toHaveProperty('cause');
  });

  it('fails a call to a missing function', async () => {
    const { math } = connectPair(createPair(sync), createMath());
    const call = (math as unknown as Channel<{ nope(): void }>).run('nope');
    await expect(call).rejects.toBeInstanceOf(RpcRemoteError);
    // A name on the prototype is not a function of the channel.
    const proto = (math as unknown as Channel<{ toString(): void }>).run('toString');
    await expect(proto).rejects.toBeInstanceOf(RpcRemoteError);
  });

  it('gives the function this.channel', async () => {
    const { math } = connectPair(createPair(sync), createMath());
    expect(await math.run('whoami')).toBe(true);
  });

  it('wraps every incoming call with onCall', async () => {
    const ports = createPair(sync);
    const seen: string[] = [];
    const host = createEndpoint(ports[1], {
      async onCall(call, next) {
        seen.push(`${call.name}:${call.args.join(',')}`);
        return (await next()) === 3 ? 30 : await next();
      },
    });
    host.serve(createMath());
    const math = createEndpoint(ports[0], {}).connect<MathFunctions>();
    expect(await math.run('add', 1, 2)).toBe(30);
    expect(seen).toEqual(['add:1,2']);
  });

  it('refuses a peer with another protocol version', async () => {
    const ports = createPair(sync);
    const client = createEndpoint(ports[0], {});
    const math = client.connect<MathFunctions>();
    const pending = math.run('add', 1, 2);
    ports[1].send([3, 99, 1]);
    await expect(pending).rejects.toBeInstanceOf(RpcTransportError);
  });

  it('fails calls in flight when the endpoint closes', async () => {
    const { client, math } = connectPair(createPair(sync), createMath());
    const slow = math.run('slow', 1000);
    await math.run('add', 1, 1);
    client.close();
    await expect(slow).rejects.toBeInstanceOf(RpcClosedError);
    await expect(math.run('add', 1, 1)).rejects.toBeInstanceOf(RpcClosedError);
    await math.closed;
  });

  it('fails calls in flight when the transport fails', async () => {
    const ports = createPair(sync);
    let fail!: (error: unknown) => void;
    const port: Port = {
      ...ports[0],
      onError(listener) {
        fail = listener;
        return () => {};
      },
    };
    const host = createEndpoint(ports[1], {});
    host.serve(createMath());
    const math = createEndpoint(port, {}).connect<MathFunctions>();
    const slow = math.run('slow', 1000);
    await math.run('add', 1, 1);
    fail(new Error('lost'));
    await expect(slow).rejects.toBeInstanceOf(RpcTransportError);
  });

  it('closes a channel from the holder and from the owner', async () => {
    const closes: string[] = [];
    const server = createMath([], {
      onClose() {
        closes.push('owner');
      },
    });
    const { math } = connectPair(createPair(sync), server);
    await math.run('add', 1, 1);
    math.close();
    await Promise.all([math.closed, server.closed]);
    expect(closes).toEqual(['owner']);
    await expect(math.run('add', 1, 1)).rejects.toBeInstanceOf(RpcClosedError);
  });

  it('keeps no state after 10,000 sequential calls', async () => {
    const { client, host, math } = connectPair(createPair(sync), createMath());
    for (let i = 0; i < 10_000; i++) {
      expect(await math.run('add', i, 1)).toBe(i + 1);
    }
    for (const endpoint of [client, host]) {
      expect(inspectEndpoint(endpoint)).toEqual({
        pending: 0,
        owned: endpoint === host ? 1 : 0,
        remote: endpoint === client ? 1 : 0,
        held: 0,
        readerKeys: 0,
      });
    }
  });
});

describe('local channel', () => {
  it('runs in place, in order', async () => {
    const heard: string[] = [];
    const channel = createMath(heard);
    channel.notify('hear', 'a');
    expect(await channel.run('add', 1, 2)).toBe(3);
    expect(heard).toEqual(['a']);
  });

  it('rejects after close', async () => {
    const channel = createMath();
    channel.close();
    await channel.closed;
    await expect(channel.run('add', 1, 2)).rejects.toBeInstanceOf(RpcClosedError);
  });
});

describe('message channel', () => {
  async function runOver(wrap: 'node' | 'web'): Promise<void> {
    const { port1, port2 } = new MessageChannel();
    const adapt = wrap === 'node' ? fromNodeWorker : fromMessagePort;
    const host = createEndpoint(adapt(port2), {});
    host.serve(createMath());
    const client = createEndpoint(adapt(port1), {});
    const math = client.connect<MathFunctions>();
    expect(await math.run('add', 20, 22)).toBe(42);
    client.close();
    host.close();
  }

  it('carries calls through the node adapter', async () => {
    await runOver('node');
  });

  it('carries calls through the postMessage adapter', async () => {
    await runOver('web');
  });
});

describe('two loaded copies of rpc', () => {
  it('closes only the channel that closed, even when both have ID 1', async () => {
    // Each copy has its own ID counter, so both roots get the same ID.
    vi.resetModules();
    const copyA = await import('../../src/index');
    vi.resetModules();
    const copyB = await import('../../src/index');
    const ports = createPair();
    const endpointA = copyA.createEndpoint(ports[0], {});
    const endpointB = copyB.createEndpoint(ports[1], {});
    const rootA = copyA.createChannel({ who: () => 'A' });
    const rootB = copyB.createChannel({ who: () => 'B' });
    endpointA.serve(rootA);
    endpointB.serve(rootB);
    const toB = endpointA.connect<{ who(): string }>();
    expect(await toB.run('who')).toBe('B');
    let closedA = false;
    rootA.closed
      .then(() => {
        closedA = true;
      })
      .catch(() => {});
    rootB.close();
    await toB.closed;
    expect(closedA).toBe(false);
  });
});

describe('thenable results', () => {
  it('refuses a result that has a `then` function, and never calls it', async () => {
    const then = vi.fn((resolve: (value: unknown) => void) => {
      resolve('chosen by the peer');
    });
    const marker = createReference('rpc-thenable-result', then);
    const [clientPort, hostPort] = createPair();
    // The host's replies rename the `thenx` key to `then`, as a hostile peer could.
    const tampered: Port = {
      ...hostPort,
      send(message) {
        hostPort.send(JSON.parse(JSON.stringify(message).replaceAll('"thenx"', '"then"')));
      },
    };
    const { math } = connectPair([clientPort, tampered], createMath());
    await expect(math.run('echo', { thenx: marker })).rejects.toBeInstanceOf(RpcTransportError);
    expect(then).not.toHaveBeenCalled();
  });
});
