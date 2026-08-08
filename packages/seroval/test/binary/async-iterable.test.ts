import { describe, expect, it } from 'vitest';
import { roundtrip, startDeserialize, startSerialize } from './utils';

const EXAMPLE = {
  title: 'Hello World',
  async *[Symbol.asyncIterator](): AsyncIterator<number> {
    await Promise.resolve();
    yield 1;
    yield 2;
    yield 3;
  },
};

describe('binary AsyncIterable', () => {
  it('supports AsyncIterables', async () => {
    const { value } = await roundtrip<typeof EXAMPLE>(EXAMPLE);
    expect(value.title).toBe('Hello World');
    expect(Symbol.asyncIterator in value).toBe(true);
    const iterator = value[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toBe(1);
    expect((await iterator.next()).value).toBe(2);
    expect((await iterator.next()).value).toBe(3);
  });

  it('reports completion after the last value', async () => {
    const { value } = await roundtrip<typeof EXAMPLE>(EXAMPLE);
    const iterator = value[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    await iterator.next();
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });

  it('supports for-await-of', async () => {
    const { value } = await roundtrip<AsyncIterable<number>>(EXAMPLE);
    const received: number[] = [];
    for await (const item of value) {
      received.push(item);
    }
    expect(received).toEqual([1, 2, 3]);
  });

  it('supports empty AsyncIterables', async () => {
    const { value } = await roundtrip<AsyncIterable<number>>({
      async *[Symbol.asyncIterator](): AsyncIterator<number> {},
    });
    const iterator = value[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });

  it('supports AsyncIterables that throw', async () => {
    const { value } = await roundtrip<AsyncIterable<number>>({
      async *[Symbol.asyncIterator](): AsyncIterator<number> {
        yield 1;
        throw new Error('async iteration failed');
      },
    });
    const iterator = value[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toBe(1);
    await expect(iterator.next()).rejects.toThrow('async iteration failed');
  });

  it('streams values as they are produced', async () => {
    let push!: (value: number) => void;
    let stop!: () => void;
    const source = {
      async *[Symbol.asyncIterator](): AsyncIterator<number> {
        while (true) {
          const next = await new Promise<number | undefined>(resolve => {
            push = resolve;
            stop = () => resolve(undefined);
          });
          if (next === undefined) {
            return;
          }
          yield next;
        }
      },
    };

    const handle = startSerialize(source);
    const result =
      await startDeserialize<AsyncIterable<number>>(handle.transport);
    const iterator = result.value[Symbol.asyncIterator]();

    const first = iterator.next();
    // The generator only starts once it is awaited, so wait for the pull.
    await new Promise(resolve => setTimeout(resolve, 0));
    push(10);
    expect((await first).value).toBe(10);

    const second = iterator.next();
    await new Promise(resolve => setTimeout(resolve, 0));
    push(20);
    expect((await second).value).toBe(20);

    await new Promise(resolve => setTimeout(resolve, 0));
    stop();
    await handle.done;
  });
});
