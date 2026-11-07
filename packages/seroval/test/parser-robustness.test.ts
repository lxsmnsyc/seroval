import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import {
  Serializer,
  SerovalParserError,
  crossSerialize,
  crossSerializeStream,
  deserialize,
  serialize,
  serializeAsync,
  toCrossJSONStream,
  toJSONAsync,
} from '../src';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function countUnhandled(run: () => Promise<unknown>): Promise<number> {
  const onUnhandled = vi.fn();
  process.on('unhandledRejection', onUnhandled);
  try {
    await run().catch(() => undefined);
    await settle();
    return onUnhandled.mock.calls.length;
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 20));
}

describe('async parser sibling promises', () => {
  it('handles a sibling that rejects while an earlier one is pending', async () => {
    const counts = [
      await countUnhandled(() => serializeAsync([later(1), Promise.reject(new Error('array'))])),
      await countUnhandled(() =>
        toJSONAsync({ a: later(1), b: Promise.reject(new Error('object')) }),
      ),
      await countUnhandled(() =>
        serializeAsync(new Map([[1, later(1)], [2, Promise.reject(new Error('map'))]])),
      ),
      await countUnhandled(() =>
        serializeAsync(new Set([later(1), Promise.reject(new Error('set'))])),
      ),
    ];
    expect(counts).toEqual([0, 0, 0, 0]);
  });

  it('still serializes the rejection', async () => {
    const back = deserialize<[Promise<number>, Promise<never>]>(
      await serializeAsync([later(1), Promise.reject(new Error('kept'))]),
    );
    await expect(back[0]).resolves.toBe(1);
    await expect(back[1]).rejects.toThrow('kept');
  });
});

describe('stream output queue', () => {
  it('emits every record in order under backpressure', async () => {
    const count = 3000;
    const values = Array.from({ length: count }, (_, i) => Promise.resolve(i));
    const seen: number[] = [];
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream(values, {
        onParse(node, initial) {
          if (!initial) {
            seen.push((node as { a: [unknown, { s: number }] }).a[1].s);
          }
          return new Promise<void>((done) => {
            queueMicrotask(done);
          });
        },
        onError: reject,
        onDone: resolve,
      });
    });
    expect(seen).toEqual(Array.from({ length: count }, (_, i) => i));
  });
});

describe('shared refs after a failed parse', () => {
  it('crossSerialize defines a value again after the call that registered it failed', () => {
    const refs = new Map<unknown, number>();
    const shared = { kept: 1 };
    expect(() =>
      crossSerialize({ shared, bad: () => undefined }, { refs, scopeId: 'S' }),
    ).toThrow(SerovalParserError);
    expect(refs.size).toBe(0);
    expect(crossSerialize({ shared }, { refs, scopeId: 'S' })).toContain('kept:1');
  });

  it('Serializer defines a value again after a failed write', () => {
    const chunks: string[] = [];
    const writer = new Serializer({
      globalIdentifier: 'X',
      onData: (chunk) => chunks.push(chunk),
      onError: () => undefined,
    });
    const shared = { kept: 1 };
    writer.write('bad', { shared, bad: () => undefined });
    writer.write('good', { shared });
    writer.close();
    expect(chunks.join('')).toContain('kept:1');
  });

  it('a stream that fails later drops the ids of records it never emitted', async () => {
    const refs = new Map<unknown, number>();
    const shared = { kept: 1 };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await new Promise<void>((resolve) => {
      crossSerializeStream(
        { p: Promise.resolve({ shared }), q: Promise.resolve(() => undefined) },
        {
          refs,
          scopeId: 'S',
          // Holding the root keeps the record for `p` queued, so it is never
          // sent before `q` fails.
          onSerialize: (_, initial) => (initial ? gate : undefined),
          onError: () => resolve(),
        },
      );
      setTimeout(release, 20);
    });
    expect(crossSerialize({ shared }, { refs, scopeId: 'S' })).toContain('kept:1');
  });
});

describe('promises that settle more than once', () => {
  class TwiceSettling<T> extends Promise<T> {
    // oxlint-disable-next-line unicorn/no-thenable -- The test needs a misbehaving `then`.
    override then<A = T, B = never>(
      onFulfilled?: ((value: T) => A | PromiseLike<A>) | null,
      onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): Promise<A | B> {
      super.then(onFulfilled, onRejected);
      return super.then(onFulfilled, onRejected);
    }
  }

  it('counts only the first settlement', async () => {
    const chunks: string[] = [];
    let done = false;
    await new Promise<void>((resolve, reject) => {
      crossSerializeStream(
        { a: TwiceSettling.resolve(1), b: later(2) },
        {
          scopeId: 'x',
          onSerialize: (chunk) => {
            chunks.push(chunk);
          },
          onError: reject,
          onDone: () => {
            done = true;
            resolve();
          },
        },
      );
    });
    expect(done).toBe(true);
    // The root, one record for `a`, one for `b`.
    expect(chunks).toHaveLength(3);
    expect(chunks[2]).toContain(',2)');
  });
});

describe('sparse arrays', () => {
  it('rejects more holes than the limit with a catchable error', () => {
    const sparse = Object.assign([], { length: 2_000_000 }) as unknown[];
    expect(() => serialize(sparse)).toThrow(SerovalParserError);
  });

  it('keeps holes below the limit', () => {
    const sparse = Object.assign([1], { length: 1000 }) as unknown[];
    expect(deserialize<unknown[]>(serialize(sparse))).toEqual(sparse);
  });
});

describe('typed array subclasses', () => {
  class Bytes extends Uint8Array {}

  it('serializes Buffer and subclasses as their base typed array', () => {
    for (const value of [Buffer.from([1, 2, 3]), new Bytes([1, 2, 3])]) {
      const back = deserialize<Uint8Array>(serialize(value));
      expect(back).toBeInstanceOf(Uint8Array);
      expect([...back]).toEqual([1, 2, 3]);
    }
  });

  it('applies the typed array limit to subclasses', () => {
    expect(() => serialize(Buffer.alloc(1_000_001))).toThrow(SerovalParserError);
    expect(() => serialize(new Bytes(1_000_001))).toThrow(SerovalParserError);
  });
});
