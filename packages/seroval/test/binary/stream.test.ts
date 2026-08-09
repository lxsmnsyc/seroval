import { describe, expect, it } from 'vitest';
import { createStream, type Stream, streamToAsyncIterable } from '../../src';
import { roundtrip, startDeserialize, startSerialize } from './utils';

function collect(stream: Stream<unknown>) {
  const next: unknown[] = [];
  const thrown: unknown[] = [];
  const returned: unknown[] = [];
  stream.on({
    next(value) {
      next.push(value);
    },
    throw(value) {
      thrown.push(value);
    },
    return(value) {
      returned.push(value);
    },
  });
  return { next, thrown, returned };
}

describe('binary Stream', () => {
  it('supports Streams that already finished', async () => {
    const source = createStream<number>();
    source.next(1);
    source.next(2);
    source.return(3);

    const { value } = await roundtrip<Stream<number>>(source);
    const events = collect(value);
    expect(events.next).toEqual([1, 2]);
    expect(events.returned).toEqual([3]);
    expect(events.thrown).toEqual([]);
  });

  it('supports Streams that throw', async () => {
    const source = createStream<number>();
    source.next(1);
    source.throw(new Error('stream failed'));

    const { value } = await roundtrip<Stream<number>>(source);
    const events = collect(value);
    expect(events.next).toEqual([1]);
    expect(events.thrown[0]).toBeInstanceOf(Error);
    expect((events.thrown[0] as Error).message).toBe('stream failed');
  });

  it('forwards values while the Stream is still open', async () => {
    const source = createStream<number>();
    const handle = startSerialize(source);
    const result = await startDeserialize<Stream<number>>(handle.transport);
    const events = collect(result.value);

    source.next(1);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(events.next).toEqual([1]);

    source.next(2);
    source.return(3);
    await handle.done;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(events.next).toEqual([1, 2]);
    expect(events.returned).toEqual([3]);
  });

  it('can be consumed as an async iterable', async () => {
    const source = createStream<number>();
    source.next(1);
    source.next(2);
    source.return(undefined as unknown as number);

    const { value } = await roundtrip<Stream<number>>(source);
    const received: number[] = [];
    for await (const item of streamToAsyncIterable(value)()) {
      received.push(item);
    }
    expect(received).toEqual([1, 2]);
  });
});
