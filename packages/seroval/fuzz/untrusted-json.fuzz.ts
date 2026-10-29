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
import { isExpectedError, snapshotPrototypes } from './safety';

// `fromJSON` and `fromCrossJSON` must withstand untrusted input. See
// `safety.ts` for what that means.
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

function expectSafeDecode(decode: () => unknown): void {
  const before = snapshotPrototypes();
  try {
    decode();
  } catch (error) {
    if (!isExpectedError(error, EXPECTED_ERRORS)) {
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
