import { describe, expect, it } from 'vitest';
import ReadableStreamPlugin from '../../../web/readable-stream';
import { roundtrip, startDeserialize, startSerialize } from './utils';

const PLUGINS = [ReadableStreamPlugin];

function fromValues<T>(values: T[]): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const value of values) {
        controller.enqueue(value);
      }
      controller.close();
    },
  });
}

async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
  const received: T[] = [];
  const reader = stream.getReader();
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    received.push(result.value);
  }
  return received;
}

describe('binary ReadableStream', () => {
  it('supports ReadableStream', async () => {
    const { value, done } = await roundtrip<ReadableStream<string>>(
      fromValues(['a', 'b', 'c']),
      PLUGINS,
    );
    expect(value).toBeInstanceOf(ReadableStream);
    expect(await drain(value)).toEqual(['a', 'b', 'c']);
    await done;
  });

  it('closes the deserialized stream when the source closes', async () => {
    const { value } = await roundtrip<ReadableStream<number>>(
      fromValues([1]),
      PLUGINS,
    );
    const reader = value.getReader();
    expect(await reader.read()).toEqual({ done: false, value: 1 });
    expect(await reader.read()).toEqual({ done: true, value: undefined });
  });

  it('supports empty streams', async () => {
    const { value } = await roundtrip<ReadableStream<never>>(
      fromValues([]),
      PLUGINS,
    );
    expect(await drain(value)).toEqual([]);
  });

  it('supports exotic chunk values', async () => {
    const { value } = await roundtrip<ReadableStream<unknown>>(
      fromValues([new Date(0), new Map([['a', 1]]), 1n]),
      PLUGINS,
    );
    const chunks = await drain(value);
    expect(chunks[0]).toBeInstanceOf(Date);
    expect(chunks[1]).toBeInstanceOf(Map);
    expect(chunks[2]).toBe(1n);
  });

  it('forwards chunks as the source produces them', async () => {
    let push!: (value: string) => void;
    let stop!: () => void;
    const source = new ReadableStream<string>({
      start(controller) {
        push = value => controller.enqueue(value);
        stop = () => controller.close();
      },
    });

    const handle = startSerialize(source, PLUGINS);
    const result = await startDeserialize<ReadableStream<string>>(
      handle.transport,
      PLUGINS,
    );
    const reader = result.value.getReader();

    push('first');
    expect(await reader.read()).toEqual({ done: false, value: 'first' });

    push('second');
    expect(await reader.read()).toEqual({ done: false, value: 'second' });

    stop();
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    await handle.done;
  });

  it('propagates an errored source', async () => {
    let fail!: (error: unknown) => void;
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('before');
        fail = error => controller.error(error);
      },
    });

    const handle = startSerialize(source, PLUGINS);
    const result = await startDeserialize<ReadableStream<string>>(
      handle.transport,
      PLUGINS,
    );
    const reader = result.value.getReader();
    expect(await reader.read()).toEqual({ done: false, value: 'before' });

    fail(new Error('stream failed'));
    await expect(reader.read()).rejects.toThrow('stream failed');
    await handle.done;
  });

  it('drops queued chunks when the source errors during start', async () => {
    // Not a seroval behaviour: erroring inside `start` discards whatever the
    // controller had already queued, so nothing is forwarded at all.
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('before');
        controller.error(new Error('stream failed'));
      },
    });

    const { value } = await roundtrip<ReadableStream<string>>(source, PLUGINS);
    await expect(value.getReader().read()).rejects.toThrow('stream failed');
  });

  it('supports streams nested in structures', async () => {
    const { value } = await roundtrip<{ body: ReadableStream<string> }>(
      { body: fromValues(['nested']) },
      PLUGINS,
    );
    expect(await drain(value.body)).toEqual(['nested']);
  });
});
