import { describe, expect, it, vi } from 'vitest';
import { binary } from '../../src';
import {
  createTransport,
  roundtrip,
  startDeserialize,
  startSerialize,
} from './utils';

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('binary Promise', () => {
  describe('fulfillment', () => {
    it('supports Promises of primitives', async () => {
      const { value } = await roundtrip<Promise<number>>(Promise.resolve(42));
      expect(value).toBeInstanceOf(Promise);
      await expect(value).resolves.toBe(42);
    });

    it('supports Promises of undefined', async () => {
      const { value } = await roundtrip<Promise<undefined>>(
        Promise.resolve(undefined),
      );
      await expect(value).resolves.toBe(undefined);
    });

    it('supports Promises of null', async () => {
      const { value } = await roundtrip<Promise<null>>(Promise.resolve(null));
      await expect(value).resolves.toBe(null);
    });

    it('supports Promises of objects', async () => {
      const { value } = await roundtrip<Promise<{ hello: string }>>(
        Promise.resolve({ hello: 'world' }),
      );
      await expect(value).resolves.toEqual({ hello: 'world' });
    });

    it('supports Promises of exotic values', async () => {
      const { value } = await roundtrip<Promise<Map<string, Set<bigint>>>>(
        Promise.resolve(new Map([['set', new Set([1n, 2n])]])),
      );
      const result = await value;
      expect(result).toBeInstanceOf(Map);
      expect(result.get('set')).toEqual(new Set([1n, 2n]));
    });

    it('flattens Promises of Promises', async () => {
      const { value } = await roundtrip<Promise<string>>(
        Promise.resolve(Promise.resolve('nested')),
      );
      await expect(value).resolves.toBe('nested');
    });

    it('supports Promises that settle later', async () => {
      const deferred = defer<string>();
      const handle = startSerialize(deferred.promise);
      const result = await startDeserialize<Promise<string>>(handle.transport);

      let settled = false;
      void result.value.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      deferred.resolve('later');
      await expect(result.value).resolves.toBe('later');
      await handle.done;
    });
  });

  describe('rejection', () => {
    it('supports Promises rejected with an Error', async () => {
      const { value } = await roundtrip<Promise<never>>(
        Promise.reject(new Error('rejected')),
      );
      const error = await value.catch((err: unknown) => err);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('rejected');
    });

    it('supports Promises rejected with a non-Error value', async () => {
      const { value } = await roundtrip<Promise<never>>(
        Promise.reject('just a string'),
      );
      await expect(value).rejects.toBe('just a string');
    });

    it('supports Promises that reject later', async () => {
      const deferred = defer<never>();
      const handle = startSerialize(deferred.promise);
      const result = await startDeserialize<Promise<never>>(handle.transport);
      const caught = result.value.catch((err: unknown) => err);

      deferred.reject(new RangeError('too late'));
      const error = await caught;
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe('too late');
      await handle.done;
    });
  });

  describe('nesting', () => {
    it('supports Promises nested in objects', async () => {
      const { value } = await roundtrip<{
        title: string;
        data: Promise<number[]>;
      }>({
        title: 'Hello World',
        data: Promise.resolve([1, 2, 3]),
      });
      expect(value.title).toBe('Hello World');
      await expect(value.data).resolves.toEqual([1, 2, 3]);
    });

    it('supports Promises nested in arrays', async () => {
      const { value } = await roundtrip<Promise<number>[]>([
        Promise.resolve(1),
        Promise.resolve(2),
      ]);
      expect(value).toHaveLength(2);
      await expect(Promise.all(value)).resolves.toEqual([1, 2]);
    });

    it('supports Promises nested in Maps and Sets', async () => {
      const { value } = await roundtrip<{
        map: Map<string, Promise<string>>;
        set: Set<Promise<string>>;
      }>({
        map: new Map([['key', Promise.resolve('map value')]]),
        set: new Set([Promise.resolve('set value')]),
      });
      await expect(value.map.get('key')).resolves.toBe('map value');
      const [first] = [...value.set];
      await expect(first).resolves.toBe('set value');
    });

    it('supports Promises resolving to other Promises', async () => {
      const { value } = await roundtrip<Promise<{ inner: Promise<string> }>>(
        Promise.resolve({ inner: Promise.resolve('deep') }),
      );
      const outer = await value;
      await expect(outer.inner).resolves.toBe('deep');
    });

    it('supports Promises resolving to an Error', async () => {
      const { value } = await roundtrip<Promise<Error>>(
        Promise.resolve(new TypeError('as a value')),
      );
      const result = await value;
      expect(result).toBeInstanceOf(TypeError);
      expect(result.message).toBe('as a value');
    });
  });

  describe('references', () => {
    it('preserves identity of repeated Promises', async () => {
      const promise = Promise.resolve('shared');
      const { value } = await roundtrip<{
        a: Promise<string>;
        b: Promise<string>;
      }>({ a: promise, b: promise });
      expect(value.a).toBe(value.b);
      await expect(value.a).resolves.toBe('shared');
    });

    it('preserves identity of a repeated resolved value', async () => {
      const shared = { id: 1 };
      const { value } = await roundtrip<{
        shared: { id: number };
        promise: Promise<{ id: number }>;
      }>({ shared, promise: Promise.resolve(shared) });
      await expect(value.promise).resolves.toBe(value.shared);
    });

    it('supports a Promise resolving to its own container', async () => {
      interface Cyclic {
        self?: Promise<Cyclic>;
      }
      const source: Cyclic = {};
      source.self = Promise.resolve(source);

      const { value } = await roundtrip<Cyclic>(source);
      await expect(value.self).resolves.toBe(value);
    });
  });

  describe('streaming', () => {
    it('resolves the root before the Promise settles', async () => {
      const deferred = defer<number>();
      const handle = startSerialize({ pending: deferred.promise });

      const result = await startDeserialize<{ pending: Promise<number> }>(
        handle.transport,
      );
      expect(result.value.pending).toBeInstanceOf(Promise);

      deferred.resolve(7);
      await expect(result.value.pending).resolves.toBe(7);
    });

    it('does not finish serializing until every Promise settles', async () => {
      const deferred = defer<number>();
      const handle = startSerialize([deferred.promise]);

      let finished = false;
      void handle.done.then(() => {
        finished = true;
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(finished).toBe(false);

      deferred.resolve(1);
      await handle.done;
      expect(finished).toBe(true);
    });

    it('settles Promises in the order they resolve', async () => {
      const first = defer<string>();
      const second = defer<string>();
      const handle = startSerialize({
        first: first.promise,
        second: second.promise,
      });
      const result = await startDeserialize<{
        first: Promise<string>;
        second: Promise<string>;
      }>(handle.transport);

      const order: string[] = [];
      const tracked = Promise.all([
        result.value.first.then(v => order.push(v)),
        result.value.second.then(v => order.push(v)),
      ]);

      second.resolve('second');
      await new Promise(resolve => setTimeout(resolve, 0));
      first.resolve('first');

      await tracked;
      expect(order).toEqual(['second', 'first']);
    });

    it('decodes correctly when chunks are split arbitrarily', async () => {
      const handle = startSerialize({ data: Promise.resolve([1, 2, 3]) });
      await handle.done;

      const transport = createTransport();
      for (const chunk of handle.transport.chunks) {
        for (let i = 0; i < chunk.length; i++) {
          transport.push(chunk.subarray(i, i + 1));
        }
      }
      transport.push(undefined);

      const result = await startDeserialize<{ data: Promise<number[]> }>(
        transport,
      );
      await expect(result.value.data).resolves.toEqual([1, 2, 3]);
    });
  });

  describe('errors', () => {
    it('reports serialization errors of the resolved value', async () => {
      const handle = startSerialize(Promise.resolve(() => 'unsupported'));
      await expect(handle.done).rejects.toThrow();
    });

    it('reports a PromiseSuccess without a matching Promise', async () => {
      const source = startSerialize(Promise.resolve(1));
      await source.done;

      const transport = createTransport();
      const errors: unknown[] = [];
      void binary.deserialize<unknown>({
        read: () => transport.read(),
        onError(error) {
          errors.push(error);
        },
      });

      // Drop the Promise declaration (chunk 1, right after the preamble) so
      // the trailing PromiseSuccess has no resolver to attach to.
      for (const chunk of source.transport.chunks.filter((_, i) => i !== 1)) {
        transport.push(chunk);
      }
      transport.push(undefined);

      await vi.waitFor(() => {
        expect(errors.length).toBeGreaterThan(0);
      });
      expect(errors[0]).toBeInstanceOf(Error);
    });

    it('leaves the Promise pending when the stream ends early', async () => {
      const deferred = defer<number>();
      const handle = startSerialize(deferred.promise);

      const errors: unknown[] = [];
      const result = await startDeserialize<Promise<number>>(handle.transport, {
        onError(error) {
          errors.push(error);
        },
      });
      const settled = result.value.then(
        () => 'resolved',
        () => 'rejected',
      );

      // Cut the stream short instead of letting the Promise settle. The root
      // was already decoded, so this is not a malformed source — the Promise
      // simply never settles.
      handle.transport.push(undefined);

      await expect(
        Promise.race([
          settled,
          new Promise(resolve => setTimeout(() => resolve('pending'), 10)),
        ]),
      ).resolves.toBe('pending');
      expect(errors).toEqual([]);

      deferred.resolve(0);
    });
  });
});
