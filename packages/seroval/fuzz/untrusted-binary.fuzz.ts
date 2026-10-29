import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SerovalAbortedError,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalError,
  SerovalMalformedBinarySourceError,
  SerovalMalformedBinaryTypeError,
  SerovalMalformedNodeError,
  SerovalMissingBinaryRefError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalUnexpectedBinaryTypeError,
  SerovalUnknownBinaryTypeError,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
} from '../src';
import { FUZZ_PARAMETERS, valueArb } from './arbitraries';
import { cutsArb, decode, encode, split } from './binary';
import { isExpectedError, snapshotPrototypes } from './safety';

// The binary `deserialize` must withstand untrusted bytes. See `safety.ts` for
// what that means. It must also settle, and leave no unhandled rejection.
const EXPECTED_ERRORS = [
  SerovalError,
  SerovalAbortedError,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalMalformedBinarySourceError,
  SerovalMalformedBinaryTypeError,
  SerovalMalformedNodeError,
  SerovalMissingBinaryRefError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalUnexpectedBinaryTypeError,
  SerovalUnknownBinaryTypeError,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
];

const DECODE_TIMEOUT = 5000;

type Mutation =
  | { kind: 'set'; at: number; byte: number }
  | { kind: 'insert'; at: number; bytes: Uint8Array }
  | { kind: 'delete'; at: number; length: number }
  | { kind: 'duplicate'; at: number; length: number; to: number }
  | { kind: 'truncate'; at: number };

// Bytes that decode as extreme lengths, counts and ids.
const hostileByteArb = fc.oneof(
  fc.integer({ min: 0, max: 255 }),
  fc.constantFrom(0x00, 0x01, 0x7f, 0x80, 0xff),
);

const positionArb = fc.double({ min: 0, max: 1, noNaN: true });

const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('set' as const), at: positionArb, byte: hostileByteArb }) },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('insert' as const),
      at: positionArb,
      bytes: fc.uint8Array({ minLength: 1, maxLength: 8 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('delete' as const),
      at: positionArb,
      length: fc.integer({ min: 1, max: 8 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('duplicate' as const),
      at: positionArb,
      length: fc.integer({ min: 1, max: 32 }),
      to: positionArb,
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('truncate' as const), at: positionArb }) },
);

const mutationsArb = fc.array(mutationArb, { minLength: 1, maxLength: 6 });

function join(...parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function mutate(source: Uint8Array, mutations: Mutation[]): Uint8Array {
  let bytes = source;
  for (const mutation of mutations) {
    const at = Math.floor(mutation.at * bytes.length);
    switch (mutation.kind) {
      case 'set':
        if (at < bytes.length) {
          bytes = bytes.slice();
          bytes[at] = mutation.byte;
        }
        break;
      case 'insert':
        bytes = join(bytes.subarray(0, at), mutation.bytes, bytes.subarray(at));
        break;
      case 'delete':
        bytes = join(bytes.subarray(0, at), bytes.subarray(at + mutation.length));
        break;
      case 'duplicate': {
        // Copies a run of bytes elsewhere, so whole nodes repeat, which
        // redeclares ids and replays operations.
        const run = bytes.slice(at, at + mutation.length);
        const to = Math.floor(mutation.to * bytes.length);
        bytes = join(bytes.subarray(0, to), run, bytes.subarray(to));
        break;
      }
      case 'truncate':
        bytes = bytes.slice(0, at);
        break;
    }
  }
  return bytes;
}

let unhandled: unknown[] = [];

function recordUnhandled(reason: unknown): void {
  unhandled.push(reason);
}

beforeAll(() => {
  process.on('unhandledRejection', recordUnhandled);
});

afterAll(() => {
  process.off('unhandledRejection', recordUnhandled);
});

function expectError(error: unknown, source: string): void {
  if (!isExpectedError(error, EXPECTED_ERRORS)) {
    throw new Error(`${source} an unexpected error: ${String(error)}`, { cause: error });
  }
}

async function expectSafeDecode(chunks: Uint8Array[]): Promise<void> {
  unhandled = [];
  const before = snapshotPrototypes();
  const reported: unknown[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), DECODE_TIMEOUT);
  });
  const outcome = await Promise.race([
    decode(chunks, {
      onError(error) {
        reported.push(error);
      },
    }).then(
      () => 'resolved' as const,
      (error: unknown) => {
        expectError(error, 'decoding rejected with');
        return 'rejected' as const;
      },
    ),
    timeout,
  ]);
  clearTimeout(timer);
  if (outcome === 'timeout') {
    throw new Error('decoding did not settle');
  }
  // Let rejections that nothing handles reach `unhandledRejection`.
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  for (const error of reported) {
    expectError(error, 'onError received');
  }
  if (unhandled.length > 0) {
    throw new Error(`decoding left an unhandled rejection: ${String(unhandled[0])}`, {
      cause: unhandled[0],
    });
  }
  expect(snapshotPrototypes()).toEqual(before);
}

describe('untrusted binary', () => {
  it('mutated serialize output', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, mutationsArb, cutsArb, async (value, mutations, cuts) => {
        const bytes = mutate(await encode(value), mutations);
        await expectSafeDecode(split(bytes, cuts));
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('mutated serialize output with a promise', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, mutationsArb, cutsArb, async (value, mutations, cuts) => {
        const bytes = mutate(await encode({ value: Promise.resolve(value) }), mutations);
        await expectSafeDecode(split(bytes, cuts));
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('arbitrary bytes after a valid preamble', async () => {
    // The preamble (type and endianness) comes first, so arbitrary bytes
    // behind a valid one reach the node decoder.
    const preamble = (await encode(undefined)).subarray(0, 2);
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 256 }), cutsArb, async (body, cuts) => {
        await expectSafeDecode(split(join(preamble, body), cuts));
      }),
      FUZZ_PARAMETERS,
    );
  });
});
