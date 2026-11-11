import { describe, expect, it, vi } from 'vitest';
import * as binary from '../../src/binary';
import { SerovalAbortedError, createPlugin } from '../../src';

/** One event of a serializer: a chunk, the end, or a failure. */
type Event = [index: number, chunk: Uint8Array | 'done' | 'error'];

/**
 * Serializes each value with one `refs` map, and records the chunks of every
 * value in the order they were produced. Resolves once each value is done or
 * failed.
 */
function serializeAll(
  values: unknown[],
  options: Partial<binary.SerializeOptions> = {},
): Promise<Event[]> {
  const refs = new Map<unknown, number>();
  const events: Event[] = [];
  let remaining = values.length;
  return new Promise((resolve) => {
    function settle(): void {
      remaining--;
      if (remaining === 0) {
        resolve(events);
      }
    }
    for (let i = 0; i < values.length; i++) {
      binary.serialize(values[i], {
        ...options,
        refs,
        onSerialize(bytes) {
          events.push([i, bytes]);
        },
        onDone() {
          events.push([i, 'done']);
          settle();
        },
        onError() {
          events.push([i, 'error']);
          settle();
        },
      });
    }
  });
}

/** Pushes the events into payloads of `session`, in order. */
function pushAll(
  session: binary.Deserializer,
  events: Event[],
  count: number,
): binary.DeserializerPayload<unknown>[] {
  const payloads: binary.DeserializerPayload<unknown>[] = [];
  for (let i = 0; i < count; i++) {
    payloads.push(session.open());
  }
  for (const [index, chunk] of events) {
    if (chunk === 'done') {
      payloads[index].end();
    } else if (chunk === 'error') {
      payloads[index].abort(new Error('failed'));
    } else {
      payloads[index].push(chunk);
    }
  }
  return payloads;
}

async function valueOf<T>(payload: binary.DeserializerPayload<unknown>): Promise<T> {
  return (await payload.result).value as T;
}

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('binary deserializer session', () => {
  it('shares references between payloads', async () => {
    const shared = { id: 1 };
    const events = await serializeAll([{ a: shared }, { b: shared }, [shared]]);
    const payloads = pushAll(binary.createDeserializer(), events, 3);
    const a = await valueOf<{ a: object }>(payloads[0]);
    const b = await valueOf<{ b: object }>(payloads[1]);
    const c = await valueOf<object[]>(payloads[2]);
    expect(a.a).toEqual({ id: 1 });
    expect(b.b).toBe(a.a);
    expect(c[0]).toBe(a.a);
  });

  it('refers to a value from the async part of a payload that is still open', async () => {
    const shared = { id: 1 };
    let resolveLater!: (value: unknown) => void;
    const later = new Promise((resolve) => {
      resolveLater = resolve;
    });
    const refs = new Map<unknown, number>();
    const session = binary.createDeserializer();
    const first = session.open<{ later: Promise<unknown> }>();
    const second = session.open<{ shared: unknown }>();
    binary.serialize(
      { later },
      { refs, onSerialize: (bytes) => first.push(bytes), onDone: () => first.end(), onError() {} },
    );
    resolveLater(shared);
    await tick();
    binary.serialize(
      { shared },
      {
        refs,
        onSerialize: (bytes) => second.push(bytes),
        onDone: () => second.end(),
        onError() {},
      },
    );
    const a = await first.result;
    const b = await second.result;
    expect(b.value.shared).toBe(await a.value.later);
  });

  it('shares references between many values that stream at once', async () => {
    const pool = Array.from({ length: 5 }, (_, id) => ({ id }));
    async function* items(offset: number): AsyncGenerator<object> {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => {
          setTimeout(resolve, (offset * 7 + i * 3) % 5);
        });
        yield pool[(offset + i) % pool.length];
      }
    }
    const values = Array.from({ length: 20 }, (_, i) => ({
      first: pool[i % pool.length],
      later: new Promise((resolve) =>
        setTimeout(() => resolve(pool[(i * 3) % pool.length]), i % 4),
      ),
      items: items(i),
    }));
    const events = await serializeAll(values);
    const payloads = pushAll(binary.createDeserializer(), events, values.length);
    const decoded = new Map<number, object>();
    function check(item: { id: number }): void {
      const known = decoded.get(item.id);
      if (known) {
        expect(item).toBe(known);
      } else {
        decoded.set(item.id, item);
      }
    }
    for (const payload of payloads) {
      const value = await valueOf<{
        first: { id: number };
        later: Promise<{ id: number }>;
        items: AsyncIterable<{ id: number }>;
      }>(payload);
      check(value.first);
      check(await value.later);
      for await (const item of value.items) {
        check(item);
      }
    }
    expect(decoded.size).toBe(pool.length);
  });

  it('decodes the root without waiting for the end', async () => {
    const events = await serializeAll([{ name: 'Ada' }]);
    const payload = binary.createDeserializer().open<{ name: string }>();
    for (const [, chunk] of events) {
      if (chunk instanceof Uint8Array) {
        payload.push(chunk);
      }
    }
    // No `end`: the bytes alone decode the root.
    await expect(payload.result).resolves.toMatchObject({ value: { name: 'Ada' } });
  });

  it('decodes chunks split at any byte', async () => {
    const shared = { id: 1 };
    const events = await serializeAll([{ a: shared, s: 'é'.repeat(50) }, { b: shared }]);
    const session = binary.createDeserializer();
    const payloads = [session.open(), session.open()];
    for (const [index, chunk] of events) {
      if (chunk === 'done') {
        payloads[index].end();
      } else if (chunk instanceof Uint8Array) {
        for (let i = 0; i < chunk.length; i++) {
          payloads[index].push(chunk.subarray(i, i + 1));
        }
      }
    }
    const a = await valueOf<{ a: object; s: string }>(payloads[0]);
    const b = await valueOf<{ b: object }>(payloads[1]);
    expect(a.s).toBe('é'.repeat(50));
    expect(b.b).toBe(a.a);
  });

  it('wraps a root value that is a promise', async () => {
    const events = await serializeAll([Promise.resolve(1)]);
    const [payload] = pushAll(binary.createDeserializer(), events, 1);
    const result = await payload.result;
    await expect(result.value).resolves.toBe(1);
  });

  it('throws on malformed bytes and aborts only that payload', async () => {
    const session = binary.createDeserializer();
    const bad = session.open();
    const good = session.open<string>();
    expect(() => bad.push(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))).toThrow();
    await expect(bad.result).rejects.toBeInstanceOf(Error);
    // Later bytes of the aborted payload are ignored.
    bad.push(new Uint8Array([1, 2, 3]));
    const events = await serializeAll(['ok']);
    for (const [, chunk] of events) {
      if (chunk === 'done') {
        good.end();
      } else if (chunk instanceof Uint8Array) {
        good.push(chunk);
      }
    }
    await expect(good.result).resolves.toMatchObject({ value: 'ok' });
  });

  it('throws when a payload ends incomplete', async () => {
    const events = await serializeAll([{ name: 'Ada' }]);
    const payload = binary.createDeserializer().open();
    const [, first] = events[0];
    payload.push((first as Uint8Array).subarray(0, 3));
    expect(() => payload.end()).toThrow();
    await expect(payload.result).rejects.toBeInstanceOf(Error);
  });

  it('throws on bytes after the end', async () => {
    const events = await serializeAll(['a']);
    const [payload] = pushAll(binary.createDeserializer(), events, 1);
    expect(() => payload.push(new Uint8Array([1]))).toThrow();
  });

  it('counts and aborts the pending values of a payload', async () => {
    const session = binary.createDeserializer();
    const payload = session.open<{ later: Promise<never> }>();
    binary.serialize(
      { later: new Promise(() => {}) },
      { refs: new Map(), onSerialize: (bytes) => payload.push(bytes), onDone() {}, onError() {} },
    );
    const { value } = await payload.result;
    expect(payload.pending).toBe(1);
    expect(session.pending).toBe(1);
    const reason = new Error('stop');
    payload.abort(reason);
    await expect(value.later).rejects.toBe(reason);
    expect(session.pending).toBe(0);
  });

  it('forgets a payload once it ends', async () => {
    const events = await serializeAll([{ later: Promise.resolve(1) }]);
    const session = binary.createDeserializer();
    const [payload] = pushAll(session, events, 1);
    const { value } = await valueOf<{ later: Promise<number> }>(payload).then((v) => ({
      value: v,
    }));
    expect(session.pending).toBe(0);
    // An abort of the session does not reach a payload that ended.
    session.abort(new Error('stop'));
    await expect(value.later).resolves.toBe(1);
  });

  it('aborts every payload, and refuses new ones', async () => {
    const session = binary.createDeserializer();
    const refs = new Map<unknown, number>();
    const first = session.open<{ later: Promise<never> }>();
    const second = session.open();
    binary.serialize(
      { later: new Promise(() => {}) },
      { refs, onSerialize: (bytes) => first.push(bytes), onDone() {}, onError() {} },
    );
    const { value } = await first.result;
    const reason = new Error('stop');
    session.abort(reason);
    await expect(value.later).rejects.toBe(reason);
    await expect(second.result).rejects.toBe(reason);
    expect(() => session.open()).toThrow(SerovalAbortedError);
  });

  it('reports an error after push returned, and aborts the payload', async () => {
    class Box {
      constructor(public value: number) {}
    }
    const failure = new Error('plugin failed');
    const BoxPlugin = createPlugin<Box, never, number>({
      tag: 'Box',
      test: (value) => value instanceof Box,
      parse: {},
      serialize: () => '',
      deserialize: () => new Box(0),
      binary: {
        serialize: (value) => value.value,
        deserialize: () => Promise.reject(failure),
      },
    });
    const onError = vi.fn();
    const events = await serializeAll([{ box: new Box(1) }], { plugins: [BoxPlugin] });
    const [payload] = pushAll(
      binary.createDeserializer({ plugins: [BoxPlugin], onError }),
      events,
      1,
    );
    await expect(payload.result).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure);

    // A payload's own `onError` runs instead of the session's.
    const own = vi.fn();
    const session = binary.createDeserializer({ plugins: [BoxPlugin], onError });
    const other = session.open({ onError: own });
    for (const [, chunk] of events) {
      if (chunk === 'done') {
        other.end();
      } else if (chunk instanceof Uint8Array) {
        other.push(chunk);
      }
    }
    await expect(other.result).rejects.toBe(failure);
    expect(own).toHaveBeenCalledWith(failure);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('sends the nodes of a failed value before it reports the error', async () => {
    const shared = { id: 1 };
    const refs = new Map<unknown, number>();
    const session = binary.createDeserializer();
    const first = session.open();
    const second = session.open<{ shared: unknown }>();
    // The first value fails in its async part, after `shared` got an id.
    await new Promise<void>((resolve) => {
      binary.serialize(
        { later: Promise.resolve({ shared, bad: Symbol('local') }) },
        {
          refs,
          onSerialize: (bytes) => first.push(bytes),
          onDone() {},
          onError() {
            // A transport tells the reader the value failed here, and drops
            // any bytes that come after.
            first.abort(new Error('failed'));
            resolve();
          },
        },
      );
    });
    binary.serialize(
      { shared },
      {
        refs,
        onSerialize: (bytes) => second.push(bytes),
        onDone: () => second.end(),
        onError() {},
      },
    );
    const { value } = await second.result;
    expect(value.shared).toEqual({ id: 1 });
  });

  it('does not cause unhandled rejections for ignored payloads', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const session = binary.createDeserializer();
      const bad = session.open();
      try {
        bad.push(new Uint8Array([0xff]));
        bad.end();
      } catch {}
      session.open();
      session.abort(new Error('stop'));
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
