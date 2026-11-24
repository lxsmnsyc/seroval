import { describe, expect, it } from 'vitest';
import type { Plugin, SerovalNode } from '../../src';
import {
  SerovalDepthLimitError,
  SerovalError,
  SerovalParserError,
  SerovalUnsupportedTypeError,
  createPlugin,
  createStream,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../../src';
import { formatErrorPath } from '../../src/core/context/error-path';

type Mode = 'sync' | 'async' | 'stream';
const MODES: Mode[] = ['sync', 'async', 'stream'];

// oxlint-disable-next-line typescript/no-explicit-any -- the plugin list holds any plugin.
type AnyPlugin = Plugin<any, any>;

async function capture(mode: Mode, value: unknown, plugins?: AnyPlugin[]): Promise<unknown> {
  try {
    if (mode === 'sync') {
      toJSON(value, { plugins });
    } else if (mode === 'async') {
      await toJSONAsync(value, { plugins });
    } else {
      let failure: unknown;
      toCrossJSONStream(value, {
        plugins,
        onParse() {
          // Records are not needed.
        },
        onError(error) {
          failure = error;
        },
      });
      if (failure === undefined) {
        throw new Error('the stream parse did not fail');
      }
      return failure;
    }
  } catch (error) {
    return error;
  }
  throw new Error('the parse did not fail');
}

// The stream mode hands `onError` the error itself, the other modes the wrapper.
function unwrap(error: unknown): unknown {
  return error instanceof SerovalParserError ? error.cause : error;
}

function getCause(error: unknown): unknown {
  return error instanceof SerovalError ? error.cause : undefined;
}

// A plain error thrown below the root reaches `onError` as it was thrown. The
// other modes wrap it in a `SerovalParserError` that has the path.
function expectOriginal(mode: Mode, error: unknown, original: unknown, path: unknown[]): void {
  if (mode === 'stream') {
    expect(error).toBe(original);
    return;
  }
  expect(error).toBeInstanceOf(SerovalParserError);
  expect(getCause(error)).toBe(original);
  expect(getPath(error)).toEqual(path);
}

function getPath(error: unknown): unknown {
  return error instanceof SerovalError ? error.path : undefined;
}

describe.each(MODES)('error paths (%s)', (mode) => {
  it('names the properties of objects and the indexes of arrays', async () => {
    const error = await capture(mode, { users: [{ name: 'a' }, { avatar: new WeakMap() }] });
    expect(unwrap(error)).toBeInstanceOf(SerovalUnsupportedTypeError);
    expect(getPath(error)).toEqual(['users', 1, 'avatar']);
    expect(getPath(unwrap(error))).toEqual(['users', 1, 'avatar']);
  });

  it('keeps the path of a key that is not an identifier', async () => {
    const error = await capture(mode, { 'a-b': { '0': new WeakMap() } });
    expect(getPath(error)).toEqual(['a-b', '0']);
  });

  it('has no path for a root value', async () => {
    const error = await capture(mode, new WeakMap());
    expect(getPath(error)).toBeUndefined();
  });

  it('marks the key or the value of a map entry', async () => {
    const key = await capture(mode, {
      m: new Map([
        [1, 2],
        [new WeakMap(), 1],
      ]),
    });
    expect(getPath(key)).toEqual(['m', 1, 'key']);
    const value = await capture(mode, { m: new Map([[1, new WeakMap()]]) });
    expect(getPath(value)).toEqual(['m', 0, 'value']);
  });

  it('names the index of a set item', async () => {
    const error = await capture(mode, { s: new Set([1, 2, new WeakMap()]) });
    expect(getPath(error)).toEqual(['s', 2]);
  });

  it('names the value of a boxed primitive', async () => {
    const boxed = await capture(mode, {
      // oxlint-disable-next-line no-new-wrappers -- the boxed value is the test subject.
      b: Object.assign(new Number(1), {
        valueOf: () => new WeakMap(),
      }),
    });
    expect(getPath(boxed)).toEqual(['b', 'valueOf']);
  });

  it('names the options of an error', async () => {
    const error = await capture(mode, { e: new Error('x', { cause: new WeakMap() }) });
    expect(getPath(error)).toEqual(['e', 'cause']);
  });

  it('names the iterator symbols and the entries behind them', async () => {
    const iterable = {
      a: 1,
      *[Symbol.iterator]() {
        yield 1;
        yield new WeakMap();
      },
    };
    const error = await capture(mode, { it: iterable });
    expect(getPath(error)).toEqual(['it', 'Symbol.iterator', 1]);
  });

  it('adds no segment for the values a plugin parses', async () => {
    class Box {
      constructor(public inner: unknown) {}
    }
    const BoxPlugin = createPlugin<Box, { inner: SerovalNode }>({
      tag: 'test-box',
      test: (value) => value instanceof Box,
      parse: {
        sync: (value, ctx) => ({ inner: ctx.parse(value.inner) }),
        async: async (value, ctx) => ({ inner: await ctx.parse(value.inner) }),
        stream: (value, ctx) => ({ inner: ctx.parse(value.inner) }),
      },
      serialize: () => '0',
      deserialize: () => new Box(0),
    });
    const error = await capture(mode, { list: [new Box({ deep: new WeakMap() })] }, [BoxPlugin]);
    expect(getPath(error)).toEqual(['list', 0, 'deep']);
  });

  it('wraps a plugin that throws a plain error under the plugin value', async () => {
    class Bad {
      readonly tag = 'bad';
    }
    const cause = new Error('plugin bug');
    const BadPlugin = createPlugin<Bad, null>({
      tag: 'test-bad',
      test: (value) => value instanceof Bad,
      parse: {
        sync() {
          throw cause;
        },
        async: async () => await Promise.reject(cause),
        stream() {
          throw cause;
        },
      },
      serialize: () => '0',
      deserialize: () => new Bad(),
    });
    const error = await capture(mode, { p: new Bad() }, [BadPlugin]);
    expectOriginal(mode, error, cause, ['p']);
  });

  it('adds the path to a depth limit error', async () => {
    let value: unknown = {};
    for (let i = 0; i < 4; i++) {
      value = { next: value };
    }
    let error: unknown;
    try {
      if (mode === 'sync') {
        toJSON(value, { depthLimit: 3 });
      } else if (mode === 'async') {
        await toJSONAsync(value, { depthLimit: 3 });
      } else {
        toCrossJSONStream(value, {
          depthLimit: 3,
          onParse() {
            // Records are not needed.
          },
          onError(failure) {
            error = failure;
          },
        });
      }
    } catch (failure) {
      error = failure;
    }
    expect(unwrap(error)).toBeInstanceOf(SerovalDepthLimitError);
    expect(getPath(error)).toEqual(['next', 'next', 'next']);
  });

  // The thrown value is the original in each case, reachable as `cause`.
  describe('thrown values that are not seroval errors', () => {
    function build(thrown: unknown): unknown {
      return {
        a: [
          {
            get b(): never {
              // oxlint-disable-next-line no-throw-literal -- the value is not an Error on purpose.
              throw thrown;
            },
          },
        ],
      };
    }

    it('keeps an error with a string path unchanged', async () => {
      const original = Object.assign(new Error('ENOENT'), { path: '/tmp/x' });
      const error = await capture(mode, build(original));
      expectOriginal(mode, error, original, ['a', 0, 'b']);
      expect(original.path).toBe('/tmp/x');
    });

    it('keeps a frozen error unchanged', async () => {
      const original = Object.freeze(new Error('frozen'));
      const error = await capture(mode, build(original));
      expectOriginal(mode, error, original, ['a', 0, 'b']);
      expect(Object.keys(original)).toEqual([]);
    });

    it('keeps a plain object unchanged', async () => {
      const original = { reason: 'plain' };
      const error = await capture(mode, build(original));
      expectOriginal(mode, error, original, ['a', 0, 'b']);
      expect(original).toEqual({ reason: 'plain' });
    });

    it('keeps a primitive reachable', async () => {
      const error = await capture(mode, build('text'));
      expectOriginal(mode, error, 'text', ['a', 0, 'b']);
    });

    it('wraps a frozen seroval error with its path', async () => {
      const original = Object.freeze(new SerovalUnsupportedTypeError(1));
      const error = await capture(mode, build(original));
      expect(getCause(error)).toBe(original);
      expect(original.path).toBeUndefined();
      expect(getPath(error)).toEqual(['a', 0, 'b']);
    });

    it('wraps a seroval error with a string path and keeps it', async () => {
      const original = Object.assign(new SerovalUnsupportedTypeError(1), { path: '/tmp/x' });
      const error = await capture(mode, build(original));
      expect(getCause(error)).toBe(original);
      expect(original.path).toBe('/tmp/x');
      expect(getPath(error)).toEqual(['a', 0, 'b']);
    });

    it('wraps a seroval error with a number path and keeps it', async () => {
      const original = Object.assign(new SerovalUnsupportedTypeError(1), { path: 5 });
      const error = await capture(mode, build(original));
      expect(getCause(error)).toBe(original);
      expect(original.path).toBe(5);
      expect(getPath(error)).toEqual(['a', 0, 'b']);
    });

    it('wraps a seroval error with a frozen path array and keeps it', async () => {
      const path = Object.freeze(['x']);
      const original = Object.assign(new SerovalUnsupportedTypeError(1), { path });
      const error = await capture(mode, build(original));
      expect(getCause(error)).toBe(original);
      expect(original.path).toBe(path);
      expect(getPath(error)).toEqual(['a', 0, 'b', 'x']);
    });

    it('adds the path once to the message of a wrapper of a frozen seroval error', async () => {
      const original = Object.freeze(
        Object.assign(new SerovalUnsupportedTypeError(1), { path: ['x'] }),
      );
      const error = await capture(mode, build(original));
      expect(getPath(error)).toEqual(['a', 0, 'b', 'x']);
      const message = error instanceof Error ? error.message : '';
      expect(message.split('At $').length).toBe(2);
      expect(message).toContain('At $.a[0].b.x');
    });
  });

  it.each([
    ['typed array', () => new Uint8Array(2)],
    ['DataView', () => new DataView(new ArrayBuffer(2))],
  ])('names the buffer of a %s', async (_name, create) => {
    // The view is at depth 2, so its buffer is the first value past the limit.
    let error: unknown;
    try {
      if (mode === 'sync') {
        toJSON({ u: create() }, { depthLimit: 2 });
      } else if (mode === 'async') {
        await toJSONAsync({ u: create() }, { depthLimit: 2 });
      } else {
        toCrossJSONStream(
          { u: create() },
          {
            depthLimit: 2,
            onParse() {
              // Records are not needed.
            },
            onError(failure) {
              error = failure;
            },
          },
        );
      }
    } catch (failure) {
      error = failure;
    }
    expect(unwrap(error)).toBeInstanceOf(SerovalDepthLimitError);
    expect(getPath(error)).toEqual(['u', 'buffer']);
  });

  it('puts the path in the development message', async () => {
    const error = await capture(mode, { users: [{ avatar: new WeakMap() }] });
    expect(error instanceof Error ? error.message : '').toContain('At $.users[0].avatar');
  });
});

describe('stream mode without onError', () => {
  it('throws the wrapper with the path and the original as cause', () => {
    const original = new Error('x');
    let caught: unknown;
    try {
      toCrossJSONStream(
        {
          a: [
            {
              get b(): never {
                throw original;
              },
            },
          ],
        },
        {
          onParse() {
            // Records are not needed.
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SerovalParserError);
    expect(getCause(caught)).toBe(original);
    expect(getPath(caught)).toEqual(['a', 0, 'b']);
  });
});

describe('late stream values', () => {
  it('start a new path at the value that arrived later', async () => {
    const failure = await new Promise<unknown>((resolve) => {
      toCrossJSONStream(
        { later: Promise.resolve({ inner: [new WeakMap()] }) },
        {
          onParse() {
            // Records are not needed.
          },
          onError: resolve,
        },
      );
    });
    expect(getPath(failure)).toEqual(['inner', 0]);
  });

  it('start a new path for a stream event', async () => {
    const stream = createStream<unknown>();
    stream.next({ ok: 1 });
    stream.next({ bad: new WeakMap() });
    const failure = await new Promise<unknown>((resolve) => {
      toCrossJSONStream(
        { s: stream },
        {
          onParse() {
            // Records are not needed.
          },
          onError: resolve,
        },
      );
    });
    expect(getPath(failure)).toEqual(['bad']);
  });
});

describe('formatErrorPath', () => {
  it('formats keys, indexes and keys that are not identifiers', () => {
    expect(formatErrorPath([])).toBe('$');
    expect(formatErrorPath(['users', 3, 'avatar'])).toBe('$.users[3].avatar');
    expect(formatErrorPath(['a-b', '0', 'Symbol.iterator'])).toBe(
      '$["a-b"]["0"]["Symbol.iterator"]',
    );
  });
});
