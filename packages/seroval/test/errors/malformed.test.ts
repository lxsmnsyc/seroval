import { describe, expect, it } from 'vitest';
import {
  Feature,
  SerovalDeserializationError,
  SerovalError,
  type SerovalJSON,
  SerovalMalformedNodeError,
  type SerovalNode,
  SerovalSerializationError,
  SerovalUnsupportedNodeError,
  compileJSON,
  createPlugin,
  fromCrossJSON,
} from '../../src';

function makeNode(value: unknown): SerovalNode {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the node is malformed on purpose.
  return value as SerovalNode;
}

// A thenable that a plugin hands back to the deserializer.
const THENABLE = createPlugin({
  tag: 'test/thenable',
  test: () => false,
  parse: {},
  serialize: () => '',
  // oxlint-disable-next-line unicorn/no-thenable -- a thenable is the point of this plugin.
  deserialize: () => ({ then: () => {} }),
});

// A plugin with a `validate` entry, which makes the node payload required.
const VALIDATED = createPlugin({
  tag: 'test/validated',
  test: () => false,
  parse: {},
  serialize: () => '',
  validate: { a: () => true },
  deserialize: () => 1,
});

function readCross(node: unknown): unknown {
  return fromCrossJSON(makeNode(node), {
    refs: new Map(),
    plugins: [THENABLE, VALIDATED],
  });
}

function capture(run: () => unknown): SerovalError {
  try {
    run();
  } catch (error) {
    if (error instanceof SerovalError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a throw');
}

// The error that the deserializer raised, under its step wrapper.
function getRoot(error: SerovalError): SerovalError {
  expect(error).toBeInstanceOf(SerovalDeserializationError);
  expect(error.cause).toBeInstanceOf(SerovalError);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- checked above.
  return error.cause as SerovalError;
}

function readError(node: unknown): SerovalError {
  return getRoot(capture(() => readCross(node)));
}

const THENABLE_NODE = { t: 25, i: 9, c: 'test/thenable', s: 0 };

interface MalformedCase {
  name: string;
  node: unknown;
  nodeId?: number;
  nodeType: number;
  detail: string;
}

const MALFORMED: MalformedCase[] = [
  {
    name: 'a negative id',
    node: { t: 5, i: -1, s: 0 },
    nodeId: -1,
    nodeType: 4,
    detail: 'id must be a non-negative integer',
  },
  {
    name: 'an unknown constant',
    node: { t: 2, s: 99 },
    nodeType: 2,
    detail: 'value is not a known one',
  },
  {
    name: 'an array without a list',
    node: { t: 9, i: 0, a: {}, o: 0 },
    nodeId: 0,
    nodeType: 9,
    detail: 'expected a list',
  },
  {
    name: 'a property key that is not a string',
    node: { t: 10, i: 0, p: { k: [{ t: 0, s: 1 }], v: [{ t: 0, s: 1 }] }, o: 0 },
    nodeType: 0,
    detail: 'property key must be a string or a symbol',
  },
  {
    name: 'a promise result for a node of another type',
    node: {
      t: 9,
      i: 0,
      a: [
        { t: 10, i: 1, p: { k: [], v: [] }, o: 0 },
        {
          t: 23,
          i: 1,
          a: [
            { t: 0, s: 0 },
            { t: 0, s: 1 },
          ],
        },
      ],
      o: 0,
    },
    nodeId: 1,
    nodeType: 23,
    detail: 'the node it refers to has a different type',
  },
  {
    name: 'a regexp source that is too long',
    node: { t: 6, i: 0, c: 'a'.repeat(20_001), m: '' },
    nodeId: 0,
    nodeType: 6,
    detail: 'regexp source is too long',
  },
  {
    name: 'a regexp with too many property escapes',
    node: { t: 6, i: 0, c: '\\p{L}'.repeat(33), m: 'u' },
    nodeId: 0,
    nodeType: 6,
    detail: 'too many regexp property escapes',
  },
  {
    name: 'an array buffer source that is not a string',
    node: { t: 19, i: 0, s: 5 },
    nodeId: 0,
    nodeType: 19,
    detail: 'source must be a string',
  },
  {
    name: 'a typed array over a value that is not a buffer',
    node: { t: 15, i: 0, c: 'Int8Array', f: { t: 0, s: 1 }, b: 0, l: 0 },
    nodeId: 0,
    nodeType: 15,
    detail: 'buffer must be an ArrayBuffer',
  },
  {
    name: 'a typed array with an offset past its buffer',
    node: { t: 15, i: 0, c: 'Int8Array', f: { t: 19, i: 1, s: '' }, b: 5, l: 0 },
    nodeId: 0,
    nodeType: 15,
    detail: 'byte offset is out of range',
  },
  {
    name: 'a promise that resolves to a thenable',
    node: { t: 12, i: 0, s: 1, f: THENABLE_NODE },
    nodeId: 9,
    nodeType: 25,
    detail: 'a promise cannot resolve to a thenable',
  },
  {
    name: 'a plugin payload that is not an object',
    node: { t: 25, i: 0, c: 'test/validated', s: null },
    nodeId: 0,
    nodeType: 25,
    detail: 'plugin payload must be an object',
  },
  {
    name: 'a settled promise that holds a thenable',
    node: {
      t: 9,
      i: 0,
      a: [
        { t: 22, i: 1, s: 2, f: { t: 0, s: 0 } },
        { t: 23, i: 2, a: [{ t: 0, s: 0 }, THENABLE_NODE] },
      ],
      o: 0,
    },
    nodeId: 9,
    nodeType: 25,
    detail: 'a promise cannot resolve to a thenable',
  },
  {
    name: 'an iterator instance over a value that is not a sequence',
    node: {
      t: 28,
      i: 0,
      a: [
        { t: 0, s: 0 },
        { t: 0, s: 1 },
      ],
    },
    nodeType: 0,
    detail: 'source must be a sequence',
  },
  {
    name: 'an async iterator instance over a value that is not a stream',
    node: {
      t: 30,
      i: 0,
      a: [
        { t: 0, s: 0 },
        { t: 0, s: 1 },
      ],
    },
    nodeType: 0,
    detail: 'source must be a stream',
  },
  {
    name: 'a sequence with an index outside its list',
    node: { t: 35, i: 0, a: [], s: 99, l: 0 },
    nodeId: 0,
    nodeType: 35,
    detail: 'start and end must be integers within the list',
  },
  {
    name: 'a bigint that is too long',
    node: { t: 3, s: '1'.repeat(10_001) },
    nodeType: 3,
    detail: 'value is too long',
  },
];

describe('malformed node detail', () => {
  for (const item of MALFORMED) {
    it('says what is wrong with ' + item.name, () => {
      const error = readError(item.node);
      expect(error).toBeInstanceOf(SerovalMalformedNodeError);
      expect(error.code).toBe('SRV008');
      expect(error.detail).toBe(item.detail);
      expect(error.nodeType).toBe(item.nodeType);
      expect(error.nodeId).toBe(item.nodeId);
      expect(error.message).toContain(': ' + item.detail);
      expect(error.message).toContain('(type ' + item.nodeType + ')');
      if (item.nodeId !== undefined) {
        expect(error.message).toContain('Malformed node ' + item.nodeId + ' (type');
      }
    });
  }

  it('reads like a sentence', () => {
    const error = readError({ t: 19, i: 12, s: 5 });
    expect(error.message).toBe('Malformed node 12 (type 19): source must be a string');
  });

  it('leaves the id and type out when the throw site has no node', () => {
    const error = new SerovalMalformedNodeError('key', 'detail');
    expect(error.message).toBe('Malformed node: detail');
    expect(error.nodeType).toBeUndefined();
    expect(error.nodeId).toBeUndefined();
  });

  it('keeps the detail on the step wrapper', () => {
    const error = capture(() => readCross({ t: 19, i: 12, s: 5 }));
    expect(error.code).toBe('SRV008');
    expect(error.detail).toBe('source must be a string');
    expect(error.nodeId).toBe(12);
  });
});

describe('unsupported node detail', () => {
  it('names the unknown node type', () => {
    const error = readError({ t: 9999, i: 3 });
    expect(error).toBeInstanceOf(SerovalUnsupportedNodeError);
    expect(error.code).toBe('SRV002');
    expect(error.detail).toBe('unknown node type');
    expect(error.nodeType).toBe(9999);
    expect(error.nodeId).toBe(3);
    expect(error.message).toBe('Unsupported node 3 (type 9999): unknown node type');
  });

  it('names a Temporal node when the feature is off', () => {
    const error = getRoot(
      capture(() =>
        fromCrossJSON(makeNode({ t: 36, i: 1, c: 0, s: 'x' }), {
          refs: new Map(),
          disabledFeatures: Feature.Temporal,
        }),
      ),
    );
    expect(error).toBeInstanceOf(SerovalUnsupportedNodeError);
    expect(error.detail).toBe('Temporal is not enabled');
    expect(error.nodeId).toBe(1);
  });

  it('names a RegExp node when the feature is off', () => {
    const error = getRoot(
      capture(() =>
        fromCrossJSON(makeNode({ t: 6, i: 1, c: 'a', m: '' }), {
          refs: new Map(),
          disabledFeatures: Feature.RegExp,
        }),
      ),
    );
    expect(error).toBeInstanceOf(SerovalUnsupportedNodeError);
    expect(error.detail).toBe('RegExp is not enabled');
    expect(error.nodeId).toBe(1);
  });
});

function compile(node: unknown, features = 0): SerovalError {
  const source: SerovalJSON = { t: makeNode(node), f: features, m: [] };
  const error = capture(() => compileJSON(source));
  expect(error).toBeInstanceOf(SerovalSerializationError);
  expect(error.cause).toBeInstanceOf(SerovalError);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- checked above.
  return error.cause as SerovalError;
}

describe('unsupported node detail in the serializer', () => {
  it('names an unknown node type', () => {
    const error = compile({ t: 9999, i: 0 });
    expect(error).toBeInstanceOf(SerovalUnsupportedNodeError);
    expect(error.detail).toBe('unknown node type');
    expect(error.nodeId).toBe(0);
  });

  it('names a Temporal node when the feature is off', () => {
    const error = compile({ t: 36, i: 0, c: 0, s: 'x' });
    expect(error.detail).toBe('Temporal is not enabled');
  });

  it('names a RegExp node when the feature is off', () => {
    const error = compile({ t: 6, i: 0, c: 'a', m: '' });
    expect(error.detail).toBe('RegExp is not enabled');
  });

  it('names a promise constructor in vanilla mode', () => {
    const error = compile({ t: 22, i: 0, s: 1, f: { t: 0, s: 0 } });
    expect(error.detail).toBe('promise constructors need a cross mode');
    expect(error.nodeType).toBe(22);
  });

  it('names a promise result in vanilla mode', () => {
    const error = compile({
      t: 23,
      i: 0,
      a: [
        { t: 0, s: 0 },
        { t: 0, s: 1 },
      ],
    });
    expect(error.detail).toBe('promise results need a cross mode');
    expect(error.nodeType).toBe(23);
  });
});
