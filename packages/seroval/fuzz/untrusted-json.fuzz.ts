// oxlint-disable no-unsafe-type-assertion -- The fuzzer hands malformed input to the decoders on purpose.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  SerovalAbortedError,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalError,
  type SerovalJSON,
  SerovalMalformedNodeError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalMissingReferenceForIdError,
  type SerovalNode,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
  fromCrossJSON,
  fromJSON,
  toCrossJSON,
  toJSON,
} from '../src';
import { FUZZ_PARAMETERS, valueArb } from './arbitraries';

// `fromJSON` and `fromCrossJSON` must withstand untrusted input. They may
// reject it with an Error, but must not overflow the stack, hang, or touch the
// built-in prototypes. With `FUZZ_STRICT_ERRORS=1`, the Error must also be one
// of these, which finds input the decoder does not validate yet.
const STRICT_ERRORS = !!process.env.FUZZ_STRICT_ERRORS;

const EXPECTED_ERRORS = [
  SerovalError,
  SerovalAbortedError,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalMalformedNodeError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalMissingReferenceForIdError,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
];

const PROTOTYPES: object[] = [
  Object.prototype,
  Array.prototype,
  Function.prototype,
  Map.prototype,
  Set.prototype,
  Promise.prototype,
  Error.prototype,
  RegExp.prototype,
  Date.prototype,
  String.prototype,
];

const NODE_FIELDS = ['t', 'i', 's', 'c', 'm', 'p', 'e', 'a', 'f', 'b', 'o', 'l', 'k', 'v'];

// Values an attacker would try in a node field.
const hostileArb = fc.oneof(
  fc.jsonValue({ maxDepth: 2 }),
  fc.integer({ min: -2, max: 64 }),
  fc.constantFrom(
    -1,
    0.5,
    2 ** 31,
    2 ** 32,
    2 ** 53,
    1e308,
    'Infinity',
    'NaN',
    '__proto__',
    'constructor',
    'prototype',
    'then',
    { length: 1e9 },
    { __proto__: null },
    [0],
    [null],
  ),
);

interface Mutation {
  target: number;
  field: string;
  // `reuse` puts another object of the same tree in the field, so the mutation
  // can forge shared references and cycles.
  value: { kind: 'hostile'; value: unknown } | { kind: 'reuse'; index: number } | { kind: 'delete' };
}

const mutationArb: fc.Arbitrary<Mutation> = fc.record({
  target: fc.nat(),
  field: fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom(...NODE_FIELDS) },
    { weight: 1, arbitrary: fc.nat({ max: 8 }).map(String) },
  ),
  value: fc.oneof(
    { weight: 4, arbitrary: hostileArb.map((value) => ({ kind: 'hostile' as const, value })) },
    { weight: 1, arbitrary: fc.nat().map((index) => ({ kind: 'reuse' as const, index })) },
    { weight: 1, arbitrary: fc.constant({ kind: 'delete' as const }) },
  ),
});

const mutationsArb = fc.array(mutationArb, { minLength: 1, maxLength: 6 });

function collectObjects(value: unknown, result: object[]): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  result.push(value);
  for (const key of Object.keys(value)) {
    collectObjects((value as Record<string, unknown>)[key], result);
  }
}

function mutate(root: unknown, mutations: Mutation[]): void {
  // Collect the objects first, so forged cycles do not loop the walk.
  const objects: object[] = [];
  collectObjects(root, objects);
  for (const mutation of mutations) {
    const target = objects[mutation.target % objects.length] as Record<string, unknown>;
    if (mutation.value.kind === 'delete') {
      Reflect.deleteProperty(target, mutation.field);
    } else {
      const value =
        mutation.value.kind === 'reuse'
          ? objects[mutation.value.index % objects.length]
          : structuredClone(mutation.value.value);
      Object.defineProperty(target, mutation.field, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }
}

function snapshotPrototypes(): unknown[][] {
  const snapshot: unknown[][] = [];
  for (const prototype of PROTOTYPES) {
    const entries: unknown[] = [Object.getPrototypeOf(prototype)];
    for (const key of Reflect.ownKeys(prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
      // oxlint-disable-next-line unbound-method -- The accessors are compared, never called.
      entries.push(key, descriptor?.value as unknown, descriptor?.get, descriptor?.set);
    }
    snapshot.push(entries);
  }
  return snapshot;
}

function isExpectedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error instanceof RangeError && error.message.includes('call stack')) {
    return false;
  }
  if (!STRICT_ERRORS) {
    return true;
  }
  for (const constructor of EXPECTED_ERRORS) {
    if (error instanceof constructor) {
      return true;
    }
  }
  return false;
}

function expectSafeDecode(decode: () => unknown): void {
  const before = snapshotPrototypes();
  try {
    decode();
  } catch (error) {
    if (!isExpectedError(error)) {
      throw new Error(`decoding threw an unexpected error: ${String(error)}`, { cause: error });
    }
  }
  expect(snapshotPrototypes()).toEqual(before);
}

describe('untrusted JSON', () => {
  it('fromJSON', () => {
    fc.assert(
      fc.property(valueArb, mutationsArb, (value, mutations) => {
        const json = JSON.parse(JSON.stringify(toJSON(value))) as SerovalJSON;
        mutate(json, mutations);
        expectSafeDecode(() => fromJSON(json));
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('fromCrossJSON', () => {
    fc.assert(
      fc.property(valueArb, mutationsArb, (value, mutations) => {
        const node = JSON.parse(JSON.stringify(toCrossJSON(value))) as SerovalNode;
        mutate(node, mutations);
        expectSafeDecode(() => fromCrossJSON(node, { refs: new Map() }));
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('fromJSON with arbitrary JSON', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (json) => {
        expectSafeDecode(() => fromJSON(json as unknown as SerovalJSON));
      }),
      FUZZ_PARAMETERS,
    );
  });
});
