import { describe, expect, it, vi } from 'vitest';
import { binary } from '../../src';
import { createTransport } from './utils';

/**
 * Hand-rolled encoders for hostile payloads. The serializer can only produce
 * well-formed streams, so anything that models an attacker has to be written
 * byte by byte. Everything here is little endian, matching the preamble below.
 */
function u32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, true);
  return new Uint8Array(buffer);
}

function f64(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  return new Uint8Array(buffer);
}

function node(...parts: (number | Uint8Array)[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += typeof part === 'number' ? 1 : part.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      result[offset++] = part;
    } else {
      result.set(part, offset);
      offset += part.length;
    }
  }
  return result;
}

const TYPE = {
  Preamble: 0,
  Root: 1,
  Constant: 2,
  Number: 3,
  String: 4,
  ObjectAssign: 7,
  ArrayAssign: 8,
  ObjectFlag: 9,
  Array: 10,
  Object: 18,
  Map: 27,
  Promise: 31,
  PromiseSuccess: 32,
  PromiseFailure: 33,
  RegExp: 34,
  Pending: 38,
} as const;

const CONSTANT = { Null: 0, Undefined: 1, True: 2 } as const;
const FLAG = { Frozen: 3 } as const;

const preamble = () => node(TYPE.Preamble, 1);
const constant = (id: number, tag: number) =>
  node(TYPE.Constant, u32(id), tag);
const numberNode = (id: number, value: number) =>
  node(TYPE.Number, u32(id), f64(value));
const stringNode = (id: number, value: string) => {
  const encoded = new TextEncoder().encode(value);
  return node(TYPE.String, u32(id), u32(encoded.length), encoded);
};
const objectNode = (id: number) => node(TYPE.Object, u32(id));
const arrayNode = (id: number, length: number) =>
  node(TYPE.Array, u32(id), u32(length));
const mapNode = (id: number) => node(TYPE.Map, u32(id));
const promiseNode = (id: number) => node(TYPE.Promise, u32(id));
const objectAssign = (id: number, key: number, value: number) =>
  node(TYPE.ObjectAssign, u32(id), u32(key), u32(value));
const arrayAssign = (id: number, index: number, value: number) =>
  node(TYPE.ArrayAssign, u32(id), u32(index), u32(value));
const objectFlag = (id: number, flag: number) =>
  node(TYPE.ObjectFlag, u32(id), flag);
const pending = (id: number, amount: number) =>
  node(TYPE.Pending, u32(id), u32(amount));
const promiseSuccess = (id: number, value: number) =>
  node(TYPE.PromiseSuccess, u32(id), u32(value));
const regexpNode = (id: number, pattern: number, flags: number) =>
  node(TYPE.RegExp, u32(id), u32(pattern), u32(flags));
const root = (id: number) => node(TYPE.Root, u32(id));

interface Attempt {
  value: Promise<{ value: unknown }>;
  errors: unknown[];
}

function feed(chunks: Uint8Array[], close = true): Attempt {
  const transport = createTransport();
  const errors: unknown[] = [];
  const value = binary.deserialize<unknown>({
    read: () => transport.read(),
    onError(error) {
      errors.push(error);
    },
  });
  // A node that fails while *constructing* a value rejects the ref it owns,
  // which surfaces on the root instead of `onError`. Both count as rejected.
  value.catch(error => {
    errors.push(error);
  });
  for (const chunk of chunks) {
    transport.push(chunk);
  }
  if (close) {
    transport.push(undefined);
  }
  return { value, errors };
}

async function expectRejected(attempt: Attempt): Promise<unknown> {
  await vi.waitFor(() => {
    expect(attempt.errors.length).toBeGreaterThan(0);
  });
  expect(attempt.errors[0]).toBeInstanceOf(Error);
  return attempt.errors[0];
}

describe('binary malformed input', () => {
  describe('prototype pollution', () => {
    it('does not pollute Object.prototype through a __proto__ key', async () => {
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, '__proto__'),
        objectNode(3),
        stringNode(4, 'polluted'),
        constant(5, CONSTANT.True),
        objectAssign(3, 4, 5),
        pending(3, 1),
        objectAssign(1, 2, 3),
        pending(1, 1),
        root(1),
      ]);

      const { value } = await attempt.value;
      expect(attempt.errors).toEqual([]);
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(Object.hasOwn(value as object, '__proto__')).toBe(true);
      expect(
        ({} as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
      expect(
        (Object.prototype as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    });

    it('does not replace the prototype of a null-prototype target', async () => {
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, '__proto__'),
        stringNode(3, 'not a prototype'),
        objectAssign(1, 2, 3),
        pending(1, 1),
        root(1),
      ]);

      const { value } = await attempt.value;
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect((value as Record<string, unknown>)['__proto__']).toBe(
        'not a prototype',
      );
    });

    it('does not overwrite constructor on the prototype chain', async () => {
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, 'constructor'),
        stringNode(3, 'hijacked'),
        objectAssign(1, 2, 3),
        pending(1, 1),
        root(1),
      ]);

      const { value } = await attempt.value;
      expect(Object.hasOwn(value as object, 'constructor')).toBe(true);
      expect(Object.prototype.constructor).toBe(Object);
      expect(({}).constructor).toBe(Object);
    });

    it('ignores non-string, non-symbol keys', async () => {
      const attempt = feed([
        preamble(),
        objectNode(1),
        numberNode(2, 42),
        stringNode(3, 'value'),
        objectAssign(1, 2, 3),
        pending(1, 1),
        root(1),
      ]);

      const { value } = await attempt.value;
      expect(Object.keys(value as object)).toEqual([]);
    });
  });

  describe('node type confusion', () => {
    it('rejects an ObjectAssign aimed at a Map', async () => {
      const attempt = feed([
        preamble(),
        mapNode(1),
        stringNode(2, 'set'),
        stringNode(3, 'clobbered'),
        objectAssign(1, 2, 3),
        root(1),
      ]);

      const error = await expectRejected(attempt);
      expect(String(error)).toContain('Unexpected binary type');
    });

    it('rejects an ObjectAssign aimed at an Array', async () => {
      const attempt = feed([
        preamble(),
        arrayNode(1, 1),
        stringNode(2, 'length'),
        numberNode(3, 4294967295),
        objectAssign(1, 2, 3),
        root(1),
      ]);

      await expectRejected(attempt);
    });

    it('rejects an ArrayAssign aimed at an Object', async () => {
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, 'value'),
        arrayAssign(1, 0, 2),
        root(1),
      ]);

      await expectRejected(attempt);
    });

    it('rejects a PromiseSuccess aimed at an Object', async () => {
      // Objects and Arrays keep a pending-state resolver in the same table as
      // Promises; resolving one early would hand out a half-built object.
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, 'value'),
        promiseSuccess(1, 2),
        root(1),
      ]);

      const error = await expectRejected(attempt);
      expect(String(error)).toContain('Unexpected binary type');
    });

    it('rejects a PromiseSuccess aimed at an Array', async () => {
      const attempt = feed([
        preamble(),
        arrayNode(1, 0),
        stringNode(2, 'value'),
        promiseSuccess(1, 2),
        root(1),
      ]);

      await expectRejected(attempt);
    });

    it('rejects an ObjectFlag aimed at a Promise', async () => {
      const attempt = feed([
        preamble(),
        promiseNode(1),
        objectFlag(1, FLAG.Frozen),
        root(1),
      ]);

      await expectRejected(attempt);
    });

    it('rejects an ObjectFlag aimed at a Map', async () => {
      const attempt = feed([
        preamble(),
        mapNode(1),
        objectFlag(1, FLAG.Frozen),
        root(1),
      ]);

      await expectRejected(attempt);
    });

    it('rejects a Pending aimed at a Promise', async () => {
      // `invalidatePending` settles the resolver with `true` once the count
      // reaches zero; aimed at a Promise that would replace the payload.
      const attempt = feed([preamble(), promiseNode(1), pending(1, 0), root(1)]);

      await expectRejected(attempt);
      // The stream is abandoned at the bad node, so no value is handed over.
      const delivered = await Promise.race([
        attempt.value.then(
          () => 'delivered',
          () => 'rejected',
        ),
        new Promise(resolve => setTimeout(() => resolve('pending'), 10)),
      ]);
      expect(delivered).toBe('pending');
    });

    it('rejects an operation aimed at an unknown id', async () => {
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, 'key'),
        objectAssign(99, 2, 2),
        root(1),
      ]);

      await expectRejected(attempt);
    });
  });

  describe('malformed payloads', () => {
    it('rejects an unknown node type', async () => {
      const attempt = feed([preamble(), node(200, u32(1))]);
      const error = await expectRejected(attempt);
      expect(String(error)).toContain('200');
    });

    it('rejects an unknown constant tag', async () => {
      const attempt = feed([preamble(), constant(1, 99), root(1)]);
      await expectRejected(attempt);
    });

    it('rejects an unknown well-known symbol tag', async () => {
      const attempt = feed([preamble(), node(6, u32(1), 99), root(1)]);
      await expectRejected(attempt);
    });

    it('rejects a truncated node', async () => {
      const attempt = feed([preamble(), node(TYPE.Number, u32(1), f64(1))]);
      await expectRejected(attempt);
    });

    it('rejects a stream that ends mid-node', async () => {
      const attempt = feed([preamble(), node(TYPE.String, u32(1), u32(64))]);
      await expectRejected(attempt);
    });

    it('rejects a stream with no root', async () => {
      const attempt = feed([preamble(), constant(1, CONSTANT.Null)]);
      await expectRejected(attempt);
    });

    it('rejects a root pointing at an undeclared id', async () => {
      const attempt = feed([preamble(), constant(1, CONSTANT.Null), root(42)]);
      await expectRejected(attempt);
    });

    it('rejects a String node that claims more bytes than it has', async () => {
      const encoded = new TextEncoder().encode('short');
      const attempt = feed([
        preamble(),
        node(TYPE.String, u32(1), u32(1000), encoded),
        root(1),
      ]);
      await expectRejected(attempt);
    });

    it('rejects a RegExp source above the length cap', async () => {
      const attempt = feed([
        preamble(),
        stringNode(1, 'a'.repeat(20_001)),
        stringNode(2, ''),
        regexpNode(3, 1, 2),
        root(3),
      ]);
      await expectRejected(attempt);
    });

    it('allows a RegExp source at the length cap', async () => {
      const attempt = feed([
        preamble(),
        stringNode(1, 'a'.repeat(20_000)),
        stringNode(2, ''),
        regexpNode(3, 1, 2),
        root(3),
      ]);
      const { value } = await attempt.value;
      expect(value).toBeInstanceOf(RegExp);
      expect(attempt.errors).toEqual([]);
    });

    it('rejects invalid RegExp flags', async () => {
      const attempt = feed([
        preamble(),
        stringNode(1, 'pattern'),
        stringNode(2, 'not-flags'),
        regexpNode(3, 1, 2),
        root(3),
      ]);
      await expectRejected(attempt);
    });

    it('rejects a RegExp whose source ref is not a String', async () => {
      const attempt = feed([
        preamble(),
        numberNode(1, 1),
        stringNode(2, ''),
        regexpNode(3, 1, 2),
        root(3),
      ]);
      await expectRejected(attempt);
    });
  });

  describe('thenable injection', () => {
    it('never lets a plugin hand a Promise a callable thenable', async () => {
      // Only a plugin can materialise a function, so a plugin is the only way
      // to aim a callable `then` at a Promise node. `deserializePluginInner`
      // awaits the plugin result, so the thenable is adopted there and the
      // Promise only ever sees its settled value - it cannot drive the
      // consumer's control flow.
      const HijackPlugin = {
        tag: 'Hijack',
        test: () => false,
        parse: {},
        serialize: () => '',
        deserialize: () => undefined,
        binary: {
          serialize: () => undefined,
          deserialize: () => ({
            then(resolve: (value: unknown) => void) {
              resolve('hijacked');
            },
          }),
        },
      } as never;

      const transport = createTransport();
      const errors: unknown[] = [];
      const result = binary.deserialize<Promise<unknown>>({
        read: () => transport.read(),
        plugins: [HijackPlugin],
        onError(error) {
          errors.push(error);
        },
      });

      for (const chunk of [
        preamble(),
        promiseNode(1),
        stringNode(2, 'Hijack'),
        constant(3, CONSTANT.Undefined),
        // Plugin node: <byte:17> <id> <tag ref> <options ref>
        node(17, u32(4), u32(2), u32(3)),
        promiseSuccess(1, 4),
        root(1),
      ]) {
        transport.push(chunk);
      }
      transport.push(undefined);

      const { value } = await result;
      const settled = await value;
      expect(settled).toBe('hijacked');
      expect(typeof settled).toBe('string');
      expect(errors).toEqual([]);
    });

    it('allows a plain `then` data property', async () => {
      // A non-callable `then` cannot hijack `await`, so it stays a plain
      // property rather than being dropped.
      const attempt = feed([
        preamble(),
        objectNode(1),
        stringNode(2, 'then'),
        stringNode(3, 'not a function'),
        objectAssign(1, 2, 3),
        pending(1, 1),
        root(1),
      ]);

      const { value } = await attempt.value;
      expect(attempt.errors).toEqual([]);
      expect((value as Record<string, unknown>).then).toBe('not a function');
      await expect(Promise.resolve(value)).resolves.toBe(value);
    });
  });
});
