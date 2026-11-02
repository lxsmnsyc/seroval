import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  serialize,
  serializeAsync,
  toJSON,
  compileJSON,
} from '../src';

const MARK = '__serovalRegExpOwnProperty';

function withOwn(key: 'flags' | 'source', value: string): RegExp {
  const re = /test/gi;
  Object.defineProperty(re, key, { value });
  return re;
}

const CASES: [string, () => RegExp][] = [
  ['flags', () => withOwn('flags', `;globalThis.${MARK}=1//`)],
  ['source', () => withOwn('source', `x/;globalThis.${MARK}=1;/`)],
];

function evaluate(output: string): unknown {
  return (0, eval)('(' + output + ')');
}

describe('RegExp own source and flags properties', () => {
  it.each(CASES)('ignores an own %s property', async (_, create) => {
    const outputs = [
      serialize(create()),
      compileJSON(toJSON(create())),
      await serializeAsync(create()),
    ];
    for (const output of outputs) {
      delete (globalThis as Record<string, unknown>)[MARK];
      const back = evaluate(output);
      expect((globalThis as Record<string, unknown>)[MARK]).toBeUndefined();
      expect(back).toBeInstanceOf(RegExp);
      expect((back as RegExp).source).toBe('test');
      expect((back as RegExp).flags).toBe('gi');
    }
    // Cross outputs need the `$R` runtime to run, so check the text instead.
    for (const output of [crossSerialize(create()), await crossSerializeAsync(create())]) {
      expect(output).not.toContain(MARK);
    }
  });

  it('rejects a Proxy around a RegExp', () => {
    const proxy = new Proxy(/test/g, {
      get(target, key) {
        if (key === 'flags') {
          return `;globalThis.${MARK}=1//`;
        }
        return Reflect.get(target, key);
      },
    });
    expect(() => serialize(proxy)).toThrow();
  });
});
