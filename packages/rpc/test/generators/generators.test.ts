/* oxlint-disable typescript/explicit-function-return-type, typescript/no-unsafe-assignment, typescript/no-unsafe-type-assertion, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-explicit-any, typescript/require-await, typescript/no-unsafe-return, typescript/no-unsafe-argument, no-unreachable-loop -- the tests call names the types forbid and read internals. */
import { describe, expect, it } from 'vitest';
import type { Port } from '../../src/index';
import { RpcClosedError, createChannel, createEndpoint } from '../../src/index';
import { inspectEndpoint } from '../../src/endpoint';
import { createPair, settle } from '../streaming/pair';

/** An async iterable that is not a native generator. */
class ReadableStreamLike {
  readonly items: number[];
  constructor(items: number[]) {
    this.items = items;
  }
  async *[Symbol.asyncIterator]() {
    yield* this.items;
  }
}

type Loose = { [name: string]: (...args: any[]) => any };

/** Lets each port tell the other when it closes, like a worker port does. */
function linkClose(a: Port, b: Port): void {
  const listeners: [Set<() => void>, Set<() => void>] = [new Set(), new Set()];
  const ends: [Port, Port] = [a, b];
  for (const self of [0, 1] as const) {
    const other = self === 0 ? 1 : 0;
    ends[self].onClose = (listener) => {
      listeners[self].add(listener);
      return () => {
        listeners[self].delete(listener);
      };
    };
    ends[self].close = () => {
      for (const listener of Array.from(listeners[other])) {
        listener();
      }
    };
  }
}

function startPair(functions: Loose) {
  const [a, b] = createPair();
  linkClose(a, b);
  const server = createEndpoint(a);
  const client = createEndpoint(b);
  server.serve(createChannel(functions));
  return { server, client, root: client.connect<Loose>() };
}

describe('two-way generators', () => {
  it('passes the values of next() to the yield expression', async () => {
    const { root } = startPair({
      async *echo() {
        const first: string = yield 'ready';
        const second: string = yield `got ${first}`;
        return `done ${second}`;
      },
    });
    const gen: AsyncGenerator<string, string, string> = await root.run('echo');
    expect(await gen.next()).toEqual({ done: false, value: 'ready' });
    expect(await gen.next('a')).toEqual({ done: false, value: 'got a' });
    expect(await gen.next('b')).toEqual({ done: true, value: 'done b' });
    expect(await gen.next()).toEqual({ done: true, value: undefined });
  });

  it('turns a sync generator into an async generator', async () => {
    const { root } = startPair({
      *count() {
        const step: number = yield 1;
        yield 1 + step;
      },
    });
    const gen = await root.run('count');
    expect(await gen.next()).toEqual({ done: false, value: 1 });
    expect(await gen.next(10)).toEqual({ done: false, value: 11 });
    expect(await gen.next()).toEqual({ done: true, value: undefined });
  });

  it('throws inside the generator, which can catch it and go on', async () => {
    const { root } = startPair({
      async *guarded() {
        try {
          yield 'one';
        } catch (error) {
          yield `caught ${(error as Error).message}`;
        }
        yield 'two';
      },
    });
    const gen = await root.run('guarded');
    expect((await gen.next()).value).toBe('one');
    expect((await gen.throw(new Error('boom'))).value).toBe('caught boom');
    expect((await gen.next()).value).toBe('two');
  });

  it('rejects when the generator does not catch the thrown error', async () => {
    const { root, client } = startPair({
      async *plain() {
        yield 1;
      },
    });
    await settle();
    const before = inspectEndpoint(client);
    const gen = await root.run('plain');
    await gen.next();
    await expect(gen.throw(new Error('boom'))).rejects.toMatchObject({ message: 'boom' });
    expect(await gen.next()).toEqual({ done: true, value: undefined });
    await settle();
    expect(inspectEndpoint(client).remote).toBe(before.remote);
  });

  it('rejects next() when the generator throws', async () => {
    const { root } = startPair({
      async *broken() {
        yield 1;
        throw new Error('bad step');
      },
    });
    const gen = await root.run('broken');
    await gen.next();
    await expect(gen.next()).rejects.toMatchObject({ message: 'bad step' });
    expect(await gen.next()).toEqual({ done: true, value: undefined });
  });

  it('runs finally on return()', async () => {
    const events: string[] = [];
    const { root } = startPair({
      async *job() {
        try {
          yield 1;
          yield 2;
        } finally {
          events.push('finally');
        }
      },
    });
    const gen = await root.run('job');
    await gen.next();
    expect(await gen.return('bye')).toEqual({ done: true, value: 'bye' });
    expect(events).toEqual(['finally']);
  });

  it('runs finally on a break out of for await', async () => {
    const events: string[] = [];
    const { root } = startPair({
      async *job() {
        try {
          for (let i = 0; i < 100; i++) {
            yield i;
          }
        } finally {
          events.push('finally');
        }
      },
    });
    const gen = await root.run('job');
    const seen: number[] = [];
    for await (const value of gen) {
      seen.push(value);
      if (value === 2) {
        break;
      }
    }
    expect(seen).toEqual([0, 1, 2]);
    expect(events).toEqual(['finally']);
  });

  it('works with a generator in an argument', async () => {
    const { root } = startPair({
      async sum(source: AsyncGenerator<number, void, number>) {
        let total = 0;
        let step = await source.next(100);
        while (!step.done) {
          total += step.value;
          step = await source.next(7);
        }
        return total;
      },
    });
    const seen: number[] = [];
    async function* numbers() {
      const first: number = yield 1;
      seen.push(first);
      yield 2;
      yield 3;
    }
    expect(await root.run('sum', numbers())).toBe(6);
    expect(seen).toEqual([7]);
  });

  it('works for a generator the server receives and returns later', async () => {
    const { root } = startPair({
      async *relay(source: AsyncGenerator<string>) {
        for await (const item of source) {
          yield item.toUpperCase();
        }
      },
    });
    function* letters() {
      yield 'a';
      yield 'b';
    }
    const gen = await root.run('relay', letters());
    const seen: string[] = [];
    for await (const item of gen) {
      seen.push(item);
    }
    expect(seen).toEqual(['A', 'B']);
  });

  it('sends a received generator on as it is', async () => {
    const { root } = startPair({
      echo(source: AsyncGenerator<number, string, number>) {
        return source;
      },
    });
    const seen: number[] = [];
    function* doubles(): Generator<number, string, number> {
      seen.push(yield 1);
      seen.push(yield 2);
      return 'end';
    }
    const gen = await root.run('echo', doubles());
    expect(Object.prototype.toString.call(gen)).toBe('[object AsyncGenerator]');
    expect(await gen.next()).toEqual({ value: 1, done: false });
    expect(await gen.next(10)).toEqual({ value: 2, done: false });
    expect(await gen.next(20)).toEqual({ value: 'end', done: true });
    expect(seen).toEqual([10, 20]);
  });

  it('leaves one-way streams to the stream path', async () => {
    const { root } = startPair({
      stream() {
        return new ReadableStreamLike([1, 2, 3]);
      },
    });
    const stream = await root.run('stream');
    const seen: number[] = [];
    for await (const item of stream) {
      seen.push(item);
    }
    expect(seen).toEqual([1, 2, 3]);
  });

  it('rejects a pending next() with RpcClosedError when the channel closes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { root, server } = startPair({
      async *slow() {
        await gate;
        yield 1;
      },
    });
    const gen = await root.run('slow');
    const pending = gen.next();
    pending.catch(() => {});
    await settle();
    server.close();
    await expect(pending).rejects.toBeInstanceOf(RpcClosedError);
    release();
    await settle();
  });

  it('rejects a pending next() with RpcClosedError when the client endpoint closes', async () => {
    const gate = new Promise<void>(() => {});
    const { root, client } = startPair({
      async *slow() {
        await gate;
        yield 1;
      },
    });
    const gen = await root.run('slow');
    const pending = gen.next();
    pending.catch(() => {});
    await settle();
    client.close();
    await expect(pending).rejects.toBeInstanceOf(RpcClosedError);
  });
});

describe('the hidden channel', () => {
  async function ownedAfter(
    functions: Loose,
    use: (root: ReturnType<ReturnType<typeof startPair>['client']['connect']>) => Promise<void>,
  ) {
    const { server, root } = startPair(functions);
    const before = inspectEndpoint(server).owned;
    await use(root as any);
    await settle();
    return { before, after: inspectEndpoint(server).owned };
  }

  it('is gone after the generator finishes', async () => {
    const { before, after } = await ownedAfter(
      {
        async *two() {
          yield 1;
        },
      },
      async (root: any) => {
        const gen = await root.run('two');
        for await (const item of gen) {
          expect(item).toBe(1);
        }
      },
    );
    expect(after).toBe(before);
  });

  it('is gone after return()', async () => {
    const { before, after } = await ownedAfter(
      {
        async *many() {
          yield 1;
          yield 2;
        },
      },
      async (root: any) => {
        const gen = await root.run('many');
        await gen.next();
        await gen.return();
      },
    );
    expect(after).toBe(before);
  });

  it('is gone after the generator throws', async () => {
    const { before, after } = await ownedAfter(
      {
        async *broken() {
          yield 1;
          throw new Error('bad');
        },
      },
      async (root: any) => {
        const gen = await root.run('broken');
        await gen.next();
        await gen.next().catch(() => {});
      },
    );
    expect(after).toBe(before);
  });

  it('is gone after a break', async () => {
    const { before, after } = await ownedAfter(
      {
        async *many() {
          yield 1;
          yield 2;
        },
      },
      async (root: any) => {
        const gen = await root.run('many');
        for await (const item of gen) {
          expect(item).toBe(1);
          break;
        }
      },
    );
    expect(after).toBe(before);
  });

  it('is gone on the caller side too for a generator in an argument', async () => {
    const [a, b] = createPair();
    const server = createEndpoint(a);
    const client = createEndpoint(b);
    server.serve(
      createChannel<Loose>({
        async drain(source: AsyncGenerator<number>) {
          let count = 0;
          for await (const item of source) {
            count += item;
          }
          return count;
        },
      }),
    );
    const root = client.connect<Loose>();
    const before = inspectEndpoint(client).owned;
    async function* items() {
      yield 1;
      yield 2;
    }
    expect(await root.run('drain', items())).toBe(3);
    await settle();
    expect(inspectEndpoint(client).owned).toBe(before);
  });
});
