import { afterEach, describe, expect, it } from 'vitest';
import {
  createReference,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  getCrossReferenceHeader,
  serialize,
  serializeAsync,
  Serializer,
  type SerovalNode,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

/**
 * Security-focused tests for the tree (non-binary) pipeline. Two very
 * different trust boundaries live here:
 *
 * - `serialize`/`crossSerialize` produce JavaScript source that is meant to be
 *   embedded in a document and evaluated. Every attacker controlled byte that
 *   reaches the output has to be escaped.
 * - `fromJSON`/`fromCrossJSON` build values out of a node tree without
 *   evaluating anything, which is the only path that may face untrusted input.
 *
 * `compileJSON` is out of scope: it compiles a node tree straight into source
 * and is intentionally unsafe against trees it did not produce.
 */

const MARKER = '__SEROVAL_TEST_PWNED__';

function pwned(): unknown {
  return (globalThis as Record<string, unknown>)[MARKER];
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[MARKER];
});

function jsonOf(node: SerovalNode, features = 127): {
  t: SerovalNode;
  f: number;
  m: number[];
} {
  return { t: node, f: features, m: [] };
}

describe('structured deserialization does not evaluate', () => {
  it('fromJSON does not evaluate anything', () => {
    const payload = `(globalThis[${JSON.stringify(MARKER)}] = 'executed')`;
    const value = fromJSON<{ code: string }>(
      jsonOf({
        t: 10,
        i: 0,
        p: { k: ['code'], v: [{ t: 1, s: payload } as never] },
        o: 0,
      } as never),
    );
    expect(value.code).toBe(payload);
    expect(pwned()).toBeUndefined();
  });

  it('fromJSON keeps a string that looks like a node tree inert', () => {
    const value = fromJSON<string>(
      jsonOf({ t: 1, s: 'Object.assign(new Error(),{})' } as never),
    );
    expect(value).toBe('Object.assign(new Error(),{})');
  });
});

/** An unescaped quote is the only way an identifier breaks out of a literal. */
const UNESCAPED_BREAKOUT = /(?<!\\)"\);globalThis/;

/** Everything a payload could use to break out of an inline script. */
const HOSTILE = '</script><img src=x onerror=alert(1)>\u2028\u2029"\\\n\u0000';

/**
 * Every entry point that turns a value into text a document can carry. The
 * escaping lives in the shared parser, but each variant reaches it by its own
 * route, so each one is checked rather than assumed.
 */
const VARIANTS: {
  name: string;
  // The sync vanilla serializer has no way to emit a Promise.
  promises?: false;
  run(value: unknown, scopeId?: string): Promise<string>;
}[] = [
  {
    name: 'serialize',
    promises: false,
    run: async (value, scopeId) => serialize(value, { scopeId } as never),
  },
  { name: 'serializeAsync', run: value => serializeAsync(value) },
  {
    name: 'crossSerialize',
    run: async (value, scopeId) => crossSerialize(value, { scopeId }),
  },
  {
    name: 'crossSerializeAsync',
    run: (value, scopeId) => crossSerializeAsync(value, { scopeId }),
  },
  {
    name: 'crossSerializeStream',
    run: (value, scopeId) =>
      new Promise<string>((resolve, reject) => {
        let result = '';
        crossSerializeStream(value, {
          scopeId,
          onSerialize(data) {
            result += data;
          },
          onDone() {
            resolve(result);
          },
          onError: reject,
        });
      }),
  },
  {
    name: 'Serializer',
    run: (value, scopeId) =>
      new Promise<string>((resolve, reject) => {
        let result = '';
        const instance = new Serializer({
          globalIdentifier: 'self._$',
          scopeId,
          onData(data) {
            result += data;
          },
          onError: reject,
          onDone() {
            resolve(result);
          },
        });
        instance.write(HOSTILE, value);
        instance.flush();
      }),
  },
  {
    name: 'toJSON',
    run: async value => JSON.stringify(toJSON(value)),
  },
  {
    name: 'toJSONAsync',
    run: async value => JSON.stringify(await toJSONAsync(value)),
  },
  {
    name: 'toCrossJSON',
    run: async value => JSON.stringify(toCrossJSON(value)),
  },
  {
    name: 'toCrossJSONAsync',
    run: async value => JSON.stringify(await toCrossJSONAsync(value)),
  },
  {
    name: 'toCrossJSONStream',
    run: value =>
      new Promise<string>((resolve, reject) => {
        let result = '';
        toCrossJSONStream(value, {
          onParse(data) {
            result += JSON.stringify(data);
          },
          onDone() {
            resolve(result);
          },
          onError: reject,
        });
      }),
  },
];

describe('script embedding escapes', () => {
  for (const variant of VARIANTS) {
    describe(variant.name, () => {
      it('escapes a hostile string value', async () => {
        const result = await variant.run({ x: HOSTILE });
        expect(result).not.toContain('</script>');
        expect(result).not.toContain('\u2028');
        expect(result).not.toContain('\u2029');
      });

      it('escapes a hostile object key', async () => {
        const result = await variant.run({ [HOSTILE]: 1 });
        expect(result).not.toContain('</script>');
        expect(result).not.toContain('\u2028');
      });

      it('escapes a hostile Error message', async () => {
        const result = await variant.run(new Error(HOSTILE));
        expect(result).not.toContain('</script>');
        expect(result).not.toContain('\u2028');
      });

      it('escapes hostile Map keys and Set members', async () => {
        const result = await variant.run({
          map: new Map([[HOSTILE, HOSTILE]]),
          set: new Set([HOSTILE]),
        });
        expect(result).not.toContain('</script>');
        expect(result).not.toContain('\u2028');
      });

      it('escapes a hostile RegExp source', async () => {
        const result = await variant.run(new RegExp(`a${HOSTILE}b`, 'g'));
        expect(result).not.toContain('</script>');
        expect(result).not.toContain('\u2028');
      });

      it.skipIf(variant.promises === false)(
        'escapes a hostile string inside a Promise',
        async () => {
          const result = await variant.run(Promise.resolve(HOSTILE));
          expect(result).not.toContain('</script>');
          expect(result).not.toContain('\u2028');
        },
      );
    });
  }

  it('escapes </script> as \\x3C so the tag cannot close', () => {
    expect(serialize({ x: '</script>' })).toContain('\\x3C/script>');
  });

  it('escapes the line separators rather than dropping them', () => {
    const result = serialize('a\u2028b\u2029c');
    expect(result).toContain('\\u2028');
    expect(result).toContain('\\u2029');
  });

  it('round-trips a hostile string through serialize', () => {
    expect(deserialize<string>(serialize(HOSTILE))).toBe(HOSTILE);
  });

  it('round-trips a hostile string through toJSON/fromJSON', () => {
    expect(fromJSON<string>(toJSON(HOSTILE))).toBe(HOSTILE);
  });

  it('round-trips a hostile object key through serialize', () => {
    const back = deserialize<Record<string, number>>(
      serialize({ [HOSTILE]: 1 }),
    );
    expect(back[HOSTILE]).toBe(1);
  });

  it('round-trips a hostile Error message through serialize', () => {
    expect(deserialize<Error>(serialize(new Error(HOSTILE))).message).toBe(
      HOSTILE,
    );
  });
});

describe('scope and reference identifiers', () => {
  // A hostile identifier must survive as data, so these evaluate the produced
  // source and assert the payload never ran - a substring check would pass on
  // an escaped quote just as happily as on a breakout.
  const BREAKOUT = `x");globalThis[${JSON.stringify(MARKER)}]='executed';("`;

  it('escapes a hostile scopeId', () => {
    const scoped = globalThis as Record<string, unknown>;
    const hadSelf = 'self' in scoped;
    scoped.self = globalThis;
    try {
      deserialize(getCrossReferenceHeader(BREAKOUT));
      deserialize(crossSerialize({ a: 1 }, { scopeId: BREAKOUT }));
      expect(pwned()).toBeUndefined();
    } finally {
      if (!hadSelf) {
        delete scoped.self;
      }
    }
  });

  it('escapes a hostile scopeId containing </script>', () => {
    const header = getCrossReferenceHeader('</script>');
    expect(header).not.toContain('</script>');
  });

  // Only the cross variants carry a scope.
  const SCOPED = ['crossSerialize', 'crossSerializeAsync', 'Serializer'];

  for (const variant of VARIANTS) {
    if (SCOPED.indexOf(variant.name) === -1) {
      continue;
    }
    it(`escapes a hostile scopeId in ${variant.name}`, async () => {
      const result = await variant.run({ a: 1 }, BREAKOUT);
      expect(result).not.toMatch(UNESCAPED_BREAKOUT);
      expect(result).not.toContain('</script>');
    });
  }

  it('escapes a hostile scopeId in crossSerializeStream', async () =>
    new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve({ a: 1 }), {
        scopeId: BREAKOUT,
        onSerialize(data) {
          expect(data).not.toMatch(UNESCAPED_BREAKOUT);
        },
        onDone: resolve,
        onError: reject,
      });
    }));

  it('escapes a hostile Serializer key', async () => {
    // `Serializer.write` puts its key straight into the emitted assignment.
    const result = await new Promise<string>((resolve, reject) => {
      let output = '';
      const instance = new Serializer({
        globalIdentifier: 'self._$',
        onData(data) {
          output += data;
        },
        onError: reject,
        onDone() {
          resolve(output);
        },
      });
      instance.write(BREAKOUT, { a: 1 });
      instance.flush();
    });
    expect(result).not.toMatch(UNESCAPED_BREAKOUT);
  });

  it('escapes a hostile reference id', () => {
    const target = () => 'referenced';
    createReference(BREAKOUT, target);
    const result = serialize({ target });
    expect(deserialize<{ target: unknown }>(result).target).toBe(target);
    expect(pwned()).toBeUndefined();
  });

  it('escapes a reference id containing </script>', () => {
    const target = () => 'referenced';
    createReference('ref</script>', target);
    expect(serialize({ target })).not.toContain('</script>');
  });
});

describe('prototype pollution', () => {
  const POLLUTING_KEYS = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
  ];

  it('does not pollute through fromJSON object keys', () => {
    for (const key of POLLUTING_KEYS) {
      const value = fromJSON<Record<string, unknown>>(
        jsonOf({
          t: 10,
          i: 0,
          p: { k: [key], v: [{ t: 1, s: 'polluted' } as never] },
          o: 0,
        } as never),
      );
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(Object.hasOwn(value, key)).toBe(true);
      expect(
        ({} as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    }
    expect(Object.prototype.constructor).toBe(Object);
  });

  it('does not pollute through fromCrossJSON object keys', () => {
    const value = fromCrossJSON<Record<string, unknown>>(
      {
        t: 10,
        i: 0,
        p: { k: ['__proto__'], v: [{ t: 1, s: 'polluted' } as never] },
        o: 0,
      } as never,
      { refs: new Map() },
    );
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(
      ({} as unknown as Record<string, unknown>).polluted,
    ).toBeUndefined();
  });

  it('does not pollute through a serialize/deserialize round trip', () => {
    const source: Record<string, unknown> = {};
    for (const key of POLLUTING_KEYS) {
      Object.defineProperty(source, key, {
        value: 'polluted',
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
    const back = deserialize<Record<string, unknown>>(serialize(source));
    expect(Object.getPrototypeOf(back)).toBe(Object.prototype);
    expect(back.__proto__).toBe('polluted');
    expect(
      ({} as unknown as Record<string, unknown>).polluted,
    ).toBeUndefined();
  });

  it('does not pollute a null-prototype object', () => {
    const source = Object.create(null) as Record<string, unknown>;
    source.__proto__ = 'polluted';
    const back = deserialize<Record<string, unknown>>(serialize(source));
    expect(Object.getPrototypeOf(back)).toBe(null);
    expect(back.__proto__).toBe('polluted');
  });
});

describe('malformed node trees', () => {
  function expectRejected(node: SerovalNode): void {
    expect(() => fromJSON(jsonOf(node))).toThrow();
  }

  it('rejects an unknown node type', () => {
    expectRejected({ t: 999, i: 0 } as never);
  });

  it('rejects an out-of-range Error constructor tag', () => {
    expectRejected({ t: 13, i: 0, s: 99, m: 'x', p: null } as never);
  });

  it('rejects an out-of-range well-known symbol index', () => {
    expectRejected({ t: 17, i: 0, s: 99 } as never);
  });

  it('rejects an out-of-range typed array tag', () => {
    expectRejected({
      t: 15,
      i: 0,
      s: 99,
      l: 0,
      c: 0,
      f: { t: 19, i: 1, s: '' },
    } as never);
  });

  it('rejects a reference id that was never registered', () => {
    expectRejected({ t: 18, i: 0, s: 'never-registered' } as never);
  });

  it('rejects a RegExp source above the length cap', () => {
    expectRejected({ t: 6, i: 0, c: 'a'.repeat(20_001), m: '' } as never);
  });

  it('rejects a bigint above the length cap', () => {
    expectRejected({ t: 3, i: 0, s: '1'.repeat(10_001) } as never);
  });

  it('rejects a base64 payload above the length cap', () => {
    expectRejected({
      t: 19,
      i: 0,
      s: 'A'.repeat(1_000_001),
    } as never);
  });

  it('rejects a plugin tag with no plugin registered', () => {
    expectRejected({ t: 25, i: 0, c: 'unregistered', s: null } as never);
  });

  it('resolves a dangling indexed value to undefined', () => {
    // Pinned rather than asserted as correct: an id that was never assigned
    // yields `undefined` instead of an error.
    expect(fromJSON(jsonOf({ t: 4, i: 42 } as never))).toBeUndefined();
  });

  it('ignores symbol keys outside the iteration protocol', () => {
    const value = fromJSON<Record<string, unknown>>(
      jsonOf({
        t: 10,
        i: 0,
        p: {
          k: [{ t: 17, i: 1, s: 1 } as never],
          v: [{ t: 1, s: 'value' } as never],
        },
        o: 0,
      } as never),
    );
    expect(Object.getOwnPropertySymbols(value)).toEqual([]);
  });
});

describe('cross reference maps', () => {
  it('keeps separate deserializations isolated when refs are not shared', () => {
    const shared = { secret: 'value' };
    const payload = toCrossJSON({ shared });

    const first = fromCrossJSON<{ shared: object }>(payload, {
      refs: new Map(),
    });
    const second = fromCrossJSON<{ shared: object }>(payload, {
      refs: new Map(),
    });
    expect(first.shared).not.toBe(second.shared);
  });

  it('rejects a second payload that reuses ids in a shared refs map', () => {
    // Sharing one refs map across unrelated sources would let a payload hand
    // out another payload's objects. Colliding ids are refused instead.
    const refs = new Map<string, unknown>();
    const shared = { secret: 'value' };
    fromCrossJSON<{ shared: object }>(toCrossJSON({ shared }), { refs });
    expect(() =>
      fromCrossJSON<{ shared: object }>(toCrossJSON({ shared }), { refs }),
    ).toThrow();
  });
});
