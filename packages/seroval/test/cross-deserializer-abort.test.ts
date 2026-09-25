import { describe, expect, it, vi } from 'vitest';
import type { SerovalNode, Stream, StreamListener } from '../src';
import {
  createCrossDeserializer,
  createPlugin,
  createStream,
  fromCrossJSON,
  fromJSON,
  SerovalAbortedError,
  toCrossJSONStream,
  toJSON,
} from '../src';

interface CollectOptions {
  plugins?: Parameters<typeof toCrossJSONStream>[1]['plugins'];
  after?: () => void;
}

function collect(
  value: unknown,
  options: CollectOptions = {},
): Promise<SerovalNode[]> {
  const records: SerovalNode[] = [];
  return new Promise((resolve, reject) => {
    toCrossJSONStream(value, {
      plugins: options.plugins,
      onParse(node) {
        records.push(node);
      },
      onDone() {
        resolve(records);
      },
      onError: reject,
    });
    options.after?.();
  });
}

function later<T>(value: T): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), 0);
  });
}

function listener<T>(): StreamListener<T> {
  return { next: vi.fn(), throw: vi.fn(), return: vi.fn() };
}

describe('createCrossDeserializer', () => {
  it('rejects pending promises with the abort reason', async () => {
    const records = await collect({
      settled: Promise.resolve('done'),
      pending: later('never delivered'),
    });
    const session = createCrossDeserializer({});
    const result = session.deserialize<{
      settled: Promise<string>;
      pending: Promise<string>;
    }>(records[0]);
    session.deserialize(records[1]);
    const reason = new Error('transport failed');
    session.abort(reason);
    await expect(result.settled).resolves.toBe('done');
    await expect(result.pending).rejects.toBe(reason);
  });

  it('rejects promises created by later records', async () => {
    const records = await collect(Promise.resolve({ inner: later('inner') }));
    const session = createCrossDeserializer({});
    const outer = session.deserialize<Promise<{ inner: Promise<string> }>>(
      records[0],
    );
    expect(session.pending).toBe(1);
    session.deserialize(records[1]);
    expect(session.pending).toBe(1);
    const reason = new Error('transport failed');
    session.abort(reason);
    expect(session.pending).toBe(0);
    await expect((await outer).inner).rejects.toBe(reason);
  });

  it('throws into open streams and leaves completed streams alone', async () => {
    const open = createStream<string>();
    const done = createStream<string>();
    open.next('open');
    done.next('done');
    done.return('end');
    const records = await collect(
      { open, done },
      {
        after() {
          open.return('closed');
        },
      },
    );
    const session = createCrossDeserializer({});
    const result = session.deserialize<{
      open: Stream<string>;
      done: Stream<string>;
    }>(records[0]);
    // Feed every record except the one that closes the open stream.
    for (let i = 1; i < records.length - 1; i++) {
      session.deserialize(records[i]);
    }
    expect(session.pending).toBe(1);
    const openListener = listener<string>();
    const doneListener = listener<string>();
    result.open.on(openListener);
    result.done.on(doneListener);
    const reason = new Error('transport failed');
    session.abort(reason);
    expect(openListener.next).toHaveBeenCalledWith('open');
    expect(openListener.throw).toHaveBeenCalledWith(reason);
    expect(doneListener.next).toHaveBeenCalledWith('done');
    expect(doneListener.return).toHaveBeenCalledWith('end');
    expect(doneListener.throw).not.toHaveBeenCalled();
  });

  it('rejects a pending next() of an async iterable', async () => {
    async function* source() {
      yield 1;
      await later(undefined);
      yield 2;
    }
    const records = await collect(source());
    const session = createCrossDeserializer({});
    const iterable = session.deserialize<AsyncIterable<number>>(records[0]);
    session.deserialize(records[1]);
    const iterator = iterable[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: false, value: 1 });
    const next = iterator.next();
    const reason = new Error('transport failed');
    session.abort(reason);
    await expect(next).rejects.toBe(reason);
  });

  it('counts pending deferred values', async () => {
    const stream = createStream<number>();
    const records = await collect(
      { promise: Promise.resolve('value'), stream },
      {
        after() {
          stream.next(1);
          stream.next(2);
          stream.return(3);
        },
      },
    );
    const session = createCrossDeserializer({});
    const counts: number[] = [];
    for (const record of records) {
      session.deserialize(record);
      counts.push(session.pending);
    }
    expect(counts).toEqual([2, 2, 2, 1, 0]);
  });

  it('is idempotent', async () => {
    const records = await collect(later('value'));
    const session = createCrossDeserializer({});
    const promise = session.deserialize<Promise<string>>(records[0]);
    const first = new Error('first');
    session.abort(first);
    session.abort(new Error('second'));
    expect(session.pending).toBe(0);
    await expect(promise).rejects.toBe(first);
  });

  it('refuses records after abort', async () => {
    const records = await collect(later('value'));
    const session = createCrossDeserializer({});
    const promise = session.deserialize<Promise<string>>(records[0]);
    const reason = new Error('transport failed');
    session.abort(reason);
    await expect(promise).rejects.toBe(reason);
    expect(() => session.deserialize(records[1])).toThrow(SerovalAbortedError);
    expect(() => session.deserialize(records[0])).toThrow(SerovalAbortedError);
    expect(session.pending).toBe(0);
  });

  it('keeps fromCrossJSON and fromJSON unchanged', async () => {
    const records = await collect({ value: later('value') });
    const refs = new Map();
    const result = fromCrossJSON<{ value: Promise<string> }>(records[0], {
      refs,
    });
    fromCrossJSON(records[1], { refs });
    await expect(result.value).resolves.toBe('value');
    expect(fromJSON(toJSON({ a: [1, 2, 3] }))).toEqual({ a: [1, 2, 3] });
  });

  it('does not track plugin-produced promises', async () => {
    class Lazy {
      constructor(public id: number) {}
    }
    const LazyPlugin = createPlugin<Lazy, SerovalNode>({
      tag: 'Lazy',
      test(value) {
        return value instanceof Lazy;
      },
      parse: {
        stream(value, ctx) {
          return ctx.parse(value.id);
        },
      },
      serialize(node, ctx) {
        return ctx.serialize(node);
      },
      deserialize(node, ctx) {
        ctx.deserialize(node);
        return new Promise(() => {
          // settled by the plugin owner, not by seroval
        });
      },
    });
    const records = await collect(new Lazy(1), { plugins: [LazyPlugin] });
    const session = createCrossDeserializer({ plugins: [LazyPlugin] });
    const promise = session.deserialize<Promise<unknown>>(records[0]);
    expect(session.pending).toBe(0);
    session.abort(new Error('transport failed'));
    const state = await Promise.race([
      promise.then(
        () => 'resolved',
        () => 'rejected',
      ),
      later('pending'),
    ]);
    expect(state).toBe('pending');
  });
});
