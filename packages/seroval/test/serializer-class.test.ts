import { describe, expect, it, vi } from 'vitest';
import { Serializer } from '../src';

interface Harness {
  data: string[];
  errors: unknown[];
  done: number;
  serializer: Serializer;
}

function createHarness(
  options?: Partial<ConstructorParameters<typeof Serializer>[0]>,
): Harness {
  const data: string[] = [];
  const errors: unknown[] = [];
  const state = { done: 0 };
  const serializer = new Serializer({
    globalIdentifier: 'self.$R',
    onData(chunk) {
      data.push(chunk);
    },
    onError(error) {
      errors.push(error);
    },
    onDone() {
      state.done++;
    },
    ...options,
  });
  return {
    data,
    errors,
    get done() {
      return state.done;
    },
    serializer,
  };
}

describe('Serializer', () => {
  it('writes a synchronous value under its key', () => {
    const h = createHarness();
    h.serializer.write('greeting', 'hello');
    h.serializer.flush();

    expect(h.data).toHaveLength(1);
    expect(h.data[0]).toContain('self.$R["greeting"]=');
    expect(h.data[0]).toContain('"hello"');
    expect(h.done).toBe(1);
  });

  it('calls onDone immediately on flush when nothing is pending', () => {
    const h = createHarness();
    h.serializer.flush();
    expect(h.done).toBe(1);
  });

  it('withholds onDone until a pending async value settles', async () => {
    const h = createHarness();
    let resolve!: (value: string) => void;
    h.serializer.write('later', new Promise<string>(r => (resolve = r)));
    h.serializer.flush();

    // Flushed, but the promise has not resolved yet.
    expect(h.done).toBe(0);
    const initialChunks = h.data.length;

    resolve('resolved');
    await vi.waitFor(() => {
      expect(h.done).toBe(1);
    });
    // A settling promise emits at least one further chunk.
    expect(h.data.length).toBeGreaterThan(initialChunks);
  });

  it('fires onDone once for several pending writes', async () => {
    const h = createHarness();
    let resolveA!: (v: number) => void;
    let resolveB!: (v: number) => void;
    h.serializer.write('a', new Promise<number>(r => (resolveA = r)));
    h.serializer.write('b', new Promise<number>(r => (resolveB = r)));
    h.serializer.flush();
    expect(h.done).toBe(0);

    resolveA(1);
    await Promise.resolve();
    expect(h.done).toBe(0); // B still pending

    resolveB(2);
    await vi.waitFor(() => {
      expect(h.done).toBe(1);
    });
  });

  describe('push', () => {
    it('generates a key and returns it', () => {
      const h = createHarness();
      const key = h.serializer.push('value');
      expect(key).toBe('0');
      expect(h.data[0]).toContain('self.$R["0"]=');
    });

    it('skips keys already taken by write', () => {
      const h = createHarness();
      h.serializer.write('0', 'taken');
      const key = h.serializer.push('value');
      expect(key).toBe('1');
    });

    it('advances across successive pushes', () => {
      const h = createHarness();
      expect(h.serializer.push('a')).toBe('0');
      expect(h.serializer.push('b')).toBe('1');
      expect(h.serializer.push('c')).toBe('2');
    });
  });

  describe('close', () => {
    it('aborts a pending write and still calls onDone', async () => {
      const h = createHarness();
      let settled = false;
      // A stream that never ends keeps the write pending.
      h.serializer.write(
        'stream',
        new Promise<never>(() => {
          settled = true;
        }),
      );
      expect(settled).toBe(true);

      h.serializer.close();
      expect(h.done).toBe(1);

      // No further onDone even if something would have resolved.
      await new Promise(r => setTimeout(r, 0));
      expect(h.done).toBe(1);
    });

    it('ignores writes after close', () => {
      const h = createHarness();
      h.serializer.close();
      const before = h.data.length;
      h.serializer.write('late', 'value');
      expect(h.data.length).toBe(before);
    });

    it('is idempotent', () => {
      const h = createHarness();
      h.serializer.close();
      h.serializer.close();
      expect(h.done).toBe(1);
    });
  });

  it('ignores writes after flush', () => {
    const h = createHarness();
    h.serializer.flush();
    const before = h.data.length;
    h.serializer.write('late', 'value');
    expect(h.data.length).toBe(before);
  });

  it('deduplicates a reference shared across writes', () => {
    const h = createHarness();
    const shared = { id: 1 };
    h.serializer.write('a', shared);
    h.serializer.write('b', shared);
    h.serializer.flush();

    // The second write refers back to the shared ref rather than re-emitting it.
    expect(h.data[1]).not.toContain('id');
  });

  it('scopes output to a scopeId', () => {
    const h = createHarness({ scopeId: 'scope' });
    // A cyclic object forces use of the shared `$R` table, which the scopeId wraps.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    h.serializer.write('key', cyclic);
    expect(h.data[0]).toContain('$R["scope"]');
  });

  it('reports serialization errors through onError', () => {
    const h = createHarness();
    // A bare function has no reference and cannot be serialized.
    h.serializer.write('fn', () => 'nope');
    expect(h.errors.length).toBeGreaterThan(0);
    expect(h.errors[0]).toBeInstanceOf(Error);
  });
});
