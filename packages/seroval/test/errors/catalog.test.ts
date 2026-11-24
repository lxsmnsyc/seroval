// oxlint-disable typescript/no-deprecated -- the deprecated class still has its code.
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, describe, expect, it } from 'vitest';
import * as api from '../../src';
import { ERROR_CODES, type ErrorCode, getCatalogEntry } from '../../src/core/error-catalog';
import { SERIALIZED_STREAM_CONSTRUCTOR } from '../../src/core/constructors';
import * as errors from '../../src/core/errors';
import { fromCrossJSON, fromJSON, serialize, toCrossJSON, toJSON } from '../../src';

const SERIALIZED_THROW = /throw new Error\('Stream consumed'\);/;
const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const CODES = Object.values(ERROR_CODES) as ErrorCode[];

function listSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSources(path));
    } else if (path.endsWith('.ts')) {
      files.push(path);
    }
  }
  return files;
}

function capture(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}

// The innermost seroval error of a chain of wrappers.
function getRoot(error: unknown): errors.SerovalError {
  assert(error instanceof errors.SerovalError);
  let current: errors.SerovalError = error;
  while (current.cause instanceof errors.SerovalError) {
    current = current.cause;
  }
  return current;
}

function makeNode(value: unknown): Parameters<typeof fromCrossJSON>[0] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the node is malformed on purpose.
  return value as Parameters<typeof fromCrossJSON>[0];
}

// A real seroval call that throws the code, or a constructor call for the
// codes that need a plugin or a custom runtime to reach.
const THROWERS: { [C in ErrorCode]: () => unknown } = {
  SRV001: () => capture(() => serialize(Symbol('x'))),
  SRV002: () => capture(() => fromCrossJSON(makeNode({ t: 9999, i: 0 }), { refs: new Map() })),
  SRV003: () => new errors.SerovalMissingPluginError('tag'),
  SRV004: () => new errors.SerovalMissingInstanceError('tag'),
  SRV005: () => new errors.SerovalMissingReferenceError(1),
  SRV006: () => new errors.SerovalMissingReferenceForIdError('id'),
  SRV007: () => new errors.SerovalUnknownTypedArrayError('Foo'),
  SRV008: () =>
    capture(() =>
      fromCrossJSON(makeNode({ ...toCrossJSON(new ArrayBuffer(0)), s: 5 }), { refs: new Map() }),
    ),
  SRV009: () => new errors.SerovalConflictedNodeIdError(makeNode({ t: 1, i: 0 })),
  SRV010: () =>
    capture(() =>
      fromCrossJSON(toCrossJSON({ a: { b: { c: 1 } } }), { depthLimit: 1, refs: new Map() }),
    ),
  SRV011: () => new errors.SerovalAbortedError(),
  SRV012: () => new errors.SerovalLiveStreamError('closed'),
  SRV013: () => new errors.SerovalPluginValidationError('tag', 'field'),
  SRV014: () => new errors.SerovalParserError(new Error('x')),
  SRV015: () => new errors.SerovalSerializationError(new Error('x')),
  SRV016: () => new errors.SerovalDeserializationError(new Error('x')),
  SRV017: () => new errors.SerovalStreamConsumedError(),
  SRV018: () => new errors.SerovalStreamOutputError(),
  SRV019: () => capture(() => fromJSON(toJSON(1), { maxBase64Length: -1 })),
  SRV020: () => capture(() => fromJSON(toJSON(new ArrayBuffer(3)), { maxBase64Length: 0 })),
};

describe('catalog', () => {
  it('has no plain throw in the sources', () => {
    for (const file of listSources(SRC)) {
      // The constructors are serialized as source text and cannot reference module bindings.
      const source = readFileSync(file, 'utf8').replace(SERIALIZED_THROW, '');
      expect(source, file).not.toMatch(/throw new (Error|TypeError)\(/);
    }
  });

  it('exports the catalog', () => {
    expect(api.ERROR_CODES).toBe(ERROR_CODES);
    expect(typeof api.getProdMessage).toBe('function');
  });

  it('throws every code with its name and code', () => {
    for (const code of CODES) {
      const thrown = THROWERS[code]();
      const entry = getCatalogEntry(code);
      assert(entry);
      if (code === 'SRV019') {
        // An option mistake stays a standard error with a code.
        assert(thrown instanceof RangeError);
        expect(entry.name).toBe('RangeError');
        expect(Reflect.get(thrown, 'code')).toBe(code);
        continue;
      }
      const leaf = getRoot(thrown);
      expect(leaf.code, code).toBe(code);
      expect(leaf.name, code).toBe(entry.name);
      expect(Object.keys(errors)).toContain(entry.name);
    }
  });

  it('wraps a limit error of a step with its code', () => {
    const thrown = THROWERS.SRV020();
    assert(thrown instanceof errors.SerovalDeserializationError);
    expect(thrown.code).toBe('SRV020');
    expect(thrown.step).toBe('deserialize');
    expect(thrown.cause).toBeInstanceOf(errors.SerovalBase64LimitError);
  });
});

describe('serialized constructors', () => {
  it('throws Stream consumed for a second consumer in a fresh realm', () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the evaluated source is the stream constructor.
    const create = vm.runInNewContext(`(${SERIALIZED_STREAM_CONSTRUCTOR})`) as (size: number) => {
      on(listener: object): void;
    };
    const stream = create(1);
    const listener = { next() {}, throw() {}, return() {} };
    stream.on(listener);
    expect(() => {
      stream.on(listener);
    }).toThrow('Stream consumed');
  });
});
