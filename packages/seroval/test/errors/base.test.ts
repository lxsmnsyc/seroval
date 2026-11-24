// oxlint-disable typescript/no-deprecated -- the deprecated class still has its code.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import {
  SerovalAbortedError,
  SerovalBase64LimitError,
  SerovalConflictedNodeIdError,
  SerovalDepthLimitError,
  SerovalDeserializationError,
  SerovalError,
  SerovalLiveStreamError,
  SerovalMalformedNodeError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalMissingReferenceError,
  SerovalMissingReferenceForIdError,
  type SerovalNode,
  SerovalParserError,
  SerovalPluginValidationError,
  SerovalSerializationError,
  SerovalStreamConsumedError,
  SerovalStreamOutputError,
  SerovalUnknownTypedArrayError,
  SerovalUnsupportedNodeError,
  SerovalUnsupportedTypeError,
} from '../../src';
import { getProdMessage } from '../../src/core/error-catalog';

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a node with only a type and an id.
const NODE = { t: 9, i: 4 } as unknown as SerovalNode;

const CASES: [string, () => SerovalError, string][] = [
  [
    'SerovalUnsupportedTypeError',
    () => new SerovalUnsupportedTypeError(Symbol('secret')),
    'SRV001',
  ],
  ['SerovalUnsupportedNodeError', () => new SerovalUnsupportedNodeError(NODE), 'SRV002'],
  ['SerovalMissingPluginError', () => new SerovalMissingPluginError('tag'), 'SRV003'],
  ['SerovalMissingInstanceError', () => new SerovalMissingInstanceError('tag'), 'SRV004'],
  ['SerovalMissingReferenceError', () => new SerovalMissingReferenceError({}), 'SRV005'],
  [
    'SerovalMissingReferenceForIdError',
    () => new SerovalMissingReferenceForIdError('id'),
    'SRV006',
  ],
  ['SerovalUnknownTypedArrayError', () => new SerovalUnknownTypedArrayError('Foo'), 'SRV007'],
  ['SerovalMalformedNodeError', () => new SerovalMalformedNodeError(NODE), 'SRV008'],
  ['SerovalConflictedNodeIdError', () => new SerovalConflictedNodeIdError(NODE), 'SRV009'],
  ['SerovalDepthLimitError', () => new SerovalDepthLimitError(2), 'SRV010'],
  ['SerovalAbortedError', () => new SerovalAbortedError(), 'SRV011'],
  ['SerovalLiveStreamError', () => new SerovalLiveStreamError('closed'), 'SRV012'],
  [
    'SerovalPluginValidationError',
    () => new SerovalPluginValidationError('tag', 'field'),
    'SRV013',
  ],
  ['SerovalParserError', () => new SerovalParserError(new Error('x')), 'SRV014'],
  ['SerovalSerializationError', () => new SerovalSerializationError(new Error('x')), 'SRV015'],
  ['SerovalDeserializationError', () => new SerovalDeserializationError(new Error('x')), 'SRV016'],
  ['SerovalStreamConsumedError', () => new SerovalStreamConsumedError(), 'SRV017'],
  ['SerovalStreamOutputError', () => new SerovalStreamOutputError(), 'SRV018'],
  ['SerovalBase64LimitError', () => new SerovalBase64LimitError(5), 'SRV020'],
];

describe('SerovalError classes', () => {
  for (const [name, create, code] of CASES) {
    it(`${name} has its name and code`, () => {
      const error = create();
      expect(error.name).toBe(name);
      expect(error.code).toBe(code);
      expect(error).toBeInstanceOf(SerovalError);
      expect(error).toBeInstanceOf(Error);
    });
  }

  it('keeps the public fields', () => {
    const symbol = Symbol('secret');
    expect(new SerovalUnsupportedTypeError(symbol).value).toBe(symbol);
    expect(new SerovalMissingReferenceError(symbol).value).toBe(symbol);
    expect(new SerovalLiveStreamError('pending').reason).toBe('pending');
    expect(new SerovalPluginValidationError('tag', 'field').field).toBe('field');
  });

  it('sets the structured fields', () => {
    const malformed = new SerovalMalformedNodeError(NODE, 'detail');
    expect(malformed.nodeType).toBe(9);
    expect(malformed.nodeId).toBe(4);
    expect(malformed.detail).toBe('detail');
    expect(new SerovalMissingPluginError('tag').tag).toBe('tag');
    expect(new SerovalDepthLimitError(2).limit).toBe(2);
    expect(new SerovalBase64LimitError(5).limit).toBe(5);
    expect(new SerovalConflictedNodeIdError(NODE).nodeId).toBe(4);
  });

  it('sets nodeType and nodeId only for a node', () => {
    const error = new SerovalMalformedNodeError('key');
    expect(error.nodeType).toBeUndefined();
    expect(error.nodeId).toBeUndefined();
  });
});

describe('step wrappers', () => {
  it('use a generic code for an error that is not from seroval', () => {
    const cause = new Error('boom');
    const cases = [
      [new SerovalParserError(cause), 'SRV014', 'parse'],
      [new SerovalSerializationError(cause), 'SRV015', 'serialize'],
      [new SerovalDeserializationError(cause), 'SRV016', 'deserialize'],
    ] as const;
    for (const [error, code, step] of cases) {
      expect(error.code).toBe(code);
      expect(error.step).toBe(step);
      expect(error.cause).toBe(cause);
      expect(error).toBeInstanceOf(SerovalError);
    }
  });

  it('take the code and fields of the error they wrap', () => {
    const inner = new SerovalMalformedNodeError(NODE, 'detail');
    const outer = new SerovalDeserializationError(inner);
    expect(outer.name).toBe('SerovalDeserializationError');
    expect(outer.code).toBe('SRV008');
    expect(outer.step).toBe('deserialize');
    expect(outer.nodeType).toBe(9);
    expect(outer.nodeId).toBe(4);
    expect(outer.detail).toBe('detail');
    expect(outer.cause).toBe(inner);
    expect(inner.step).toBe('deserialize');
  });

  it('give an unknown step the generic code and a message', () => {
    const error = new SerovalError('whatever', 'text');
    expect(error.code).toBe('SRV014');
    expect(error.step).toBeUndefined();
    expect(error.message).toContain('whatever');
    expect(error.message).not.toContain('undefined');
  });

  it('keep the two-argument base constructor', () => {
    const error = new SerovalError('parsing', 'text');
    expect(error.code).toBe('SRV014');
    expect(error.cause).toBe('text');
  });
});

describe('development messages', () => {
  it('say what went wrong', () => {
    expect(new SerovalDepthLimitError(2).message).toBe('Depth limit of 2 reached');
    expect(new SerovalMissingPluginError('tag').message).toBe('Missing plugin for tag "tag".');
    expect(new SerovalMalformedNodeError(NODE, 'why').message).toContain('why');
  });
});

describe('production messages', () => {
  it('have the code, the step and the docs link, and no values', async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL('../../src/core/errors.ts', import.meta.url))],
      bundle: true,
      format: 'esm',
      write: false,
      define: { 'import.meta.env.PROD': 'true' },
    });
    const code = result.outputFiles[0].text;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bundle exports the error classes.
    const mod = (await import(
      `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
    )) as Record<string, new (...args: unknown[]) => SerovalError>;
    const secret = 'sensitive-value';
    const leaf = new mod.SerovalUnsupportedTypeError(secret);
    expect(leaf.message).toBe(getProdMessage('SRV001'));
    expect(leaf.message).not.toContain(secret);
    const wrapped = new mod.SerovalDeserializationError(
      new mod.SerovalMalformedNodeError({ t: 1, i: 2 }, secret),
    );
    expect(wrapped.step).toBe('deserialize');
    expect(wrapped.message).toBe(
      'Seroval SRV008 (deserialize): https://seroval.vercel.app/docs/errors/SRV008',
    );
    const generic = new mod.SerovalParserError(new Error(secret));
    expect(generic.message).toBe(getProdMessage('SRV014', 'parse'));
    expect(new mod.SerovalAbortedError().message).toBe(
      'Seroval SRV011: https://seroval.vercel.app/docs/errors/SRV011',
    );
  });
});
