/* oxlint-disable typescript/explicit-function-return-type, typescript/no-unsafe-assignment, typescript/strict-void-return, typescript/no-explicit-any, typescript/no-unsafe-type-assertion, typescript/require-await -- the tests call names the types forbid and read internals. */
import { describe, expect, it, vi } from 'vitest';
import { RpcClosedError, RpcTransportError, createChannel, createEndpoint } from '../../src/index';
import type { Channel, ChannelOptions } from '../../src/index';
import { getOwnerCore } from '../../src/channel';
import { inspectEndpoint } from '../../src/endpoint';
import { createPair, settle } from '../streaming/pair';

type Loose = { [name: string]: (...args: any[]) => any };

interface Counter {
  bump(by: number): number;
}

function createCounter(start: number, events?: string[], name = 'counter'): Channel<Counter> {
  let total = start;
  return createChannel<Counter>(
    {
      bump(by: number) {
        total += by;
        return total;
      },
    },
    {
      onClose() {
        events?.push(name);
      },
    },
  );
}

function startPair(functions: Loose, options?: ChannelOptions) {
  const [a, b] = createPair();
  const server = createEndpoint(a);
  const client = createEndpoint(b);
  const rootChannel = createChannel(functions, options);
  server.serve(rootChannel);
  return { server, client, rootChannel, root: client.connect<Loose>() };
}

describe('channels in values', () => {
  it('returns a new channel for each call and the caller uses it', async () => {
    const { root } = startPair({
      makeCounter(start: number) {
        return createCounter(start);
      },
    });
    const one: Channel<Counter> = await root.run('makeCounter', 10);
    const two: Channel<Counter> = await root.run('makeCounter', 100);
    expect(one).not.toBe(two);
    expect(await one.run('bump', 1)).toBe(11);
    expect(await two.run('bump', 1)).toBe(101);
    expect(await one.run('bump', 1)).toBe(12);
  });

  it('sends a channel in an argument and the callee calls back', async () => {
    const { root } = startPair({
      async useChannel(channel: Channel<Counter>) {
        await channel.run('bump', 1);
        return await channel.run('bump', 1);
      },
    });
    expect(await root.run('useChannel', createCounter(0))).toBe(2);
  });

  it('reaches the other side as the same receiver when sent twice', async () => {
    let held: Channel<Counter> | undefined;
    const { root, client } = startPair({
      keep(channel: Channel<Counter>) {
        held = channel;
      },
      isKept(channel: Channel<Counter>) {
        return channel === held;
      },
    });
    const counter = createCounter(0);
    await root.run('keep', counter);
    expect(await root.run('isKept', counter)).toBe(true);
    // The caller holds the channel once.
    expect(inspectEndpoint(client).owned).toBe(1);
  });

  it('gives the same receiver when the owner returns one channel twice', async () => {
    const counter = createCounter(0);
    const { root } = startPair({
      kept() {
        return counter;
      },
    });
    const one = await root.run('kept');
    const two = await root.run('kept');
    expect(one).toBe(two);
  });

  it('refuses a second channel under an ID the endpoint holds', async () => {
    const { root } = startPair({ keep() {} });
    const first = createCounter(0);
    const second = createCounter(0);
    // Two copies of rpc would each count from 1, so force the clash.
    (getOwnerCore(second) as { id: number }).id = getOwnerCore(first)!.id;
    await root.run('keep', first);
    await expect(root.run('keep', second)).rejects.toBeInstanceOf(RpcTransportError);
    // The first channel still works.
    expect(await first.run('bump', 1)).toBe(1);
  });

  it('rejects a call on a closed channel without an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const { root } = startPair({
        makeCounter(start: number) {
          return createCounter(start);
        },
      });
      const counter: Channel<Counter> = await root.run('makeCounter', 0);
      counter.close();
      await counter.closed;
      await expect(counter.run('bump', 1)).rejects.toBeInstanceOf(RpcClosedError);
      counter.notify('bump', 1);
      await settle();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});

describe('closing', () => {
  it('settles closed on both sides and runs onClose once when the holder closes', async () => {
    const events: string[] = [];
    const counter = createCounter(0, events);
    const { root, client } = startPair({
      kept() {
        return counter;
      },
    });
    const holder: Channel<Counter> = await root.run('kept');
    holder.close();
    holder.close();
    await holder.closed;
    await counter.closed;
    await settle();
    expect(events).toEqual(['counter']);
    // The holder's table dropped it, leaving the root.
    expect(inspectEndpoint(client).remote).toBe(1);
  });

  it('settles closed on the holder and runs onClose once when the owner closes', async () => {
    const events: string[] = [];
    const owner = createCounter(0, events);
    const { root } = startPair({
      kept() {
        return owner;
      },
    });
    const holder: Channel<Counter> = await root.run('kept');
    owner.close();
    await owner.closed;
    await holder.closed;
    expect(events).toEqual(['counter']);
    await expect(holder.run('bump', 1)).rejects.toBeInstanceOf(RpcClosedError);
  });

  it('closes the endpoint when the root closes, nested channels first', async () => {
    const events: string[] = [];
    let made = 0;
    const { server, root, rootChannel } = startPair(
      {
        makeCounter() {
          made += 1;
          return createCounter(0, events, `nested-${made}`);
        },
      },
      {
        onClose() {
          events.push('root');
        },
      },
    );
    await root.run('makeCounter');
    await root.run('makeCounter');
    rootChannel.close();
    await rootChannel.closed;
    await root.closed;
    expect(events).toEqual(['nested-2', 'nested-1', 'root']);
    await expect(root.run('makeCounter')).rejects.toBeInstanceOf(RpcClosedError);
    expect(inspectEndpoint(server).owned).toBe(0);
  });

  it('closes the root from the holder and the owner side stops', async () => {
    const events: string[] = [];
    const { root, rootChannel } = startPair(
      { keep() {} },
      {
        onClose() {
          events.push('root');
        },
      },
    );
    await root.run('keep');
    root.close();
    await root.closed;
    await rootChannel.closed;
    expect(events).toEqual(['root']);
  });

  it('runs a throwing onClose, reports it and runs the rest', async () => {
    const events: string[] = [];
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const { client, root, rootChannel } = startPair(
        {
          makeNested() {
            return createChannel(
              {},
              {
                onClose() {
                  throw new Error('boom');
                },
              },
            );
          },
        },
        {
          onClose() {
            events.push('root');
          },
        },
      );
      await root.run('makeNested');
      client.close();
      await rootChannel.closed;
      expect(events).toEqual(['root']);
      await settle();
      expect(unhandled).toHaveBeenCalledTimes(1);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
