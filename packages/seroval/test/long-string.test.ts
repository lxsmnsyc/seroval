import { describe, expect, it } from 'vitest';
import {
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONStream,
  toJSON,
} from '../src';
import { serializeString } from '../src/core/string';

const escapes: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\b': '\\b',
  '\t': '\\t',
  '\f': '\\f',
  '<': '\\x3C',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};
const cases = [
  ['below threshold', 'x'.repeat(1023)],
  ['at threshold', 'x'.repeat(1024)],
  ['above threshold', 'x'.repeat(1025)],
  [
    'JSON text',
    JSON.stringify({ items: new Array(100).fill({ text: 'a"b\\c\n' }) }),
  ],
  ['HTML and separators', '</script><!--\u2028\u2029'.repeat(128)],
  ['Latin-1 and BMP', 'caf\u00e9 \u4e2d\u6587'.repeat(256)],
  ['surrogate pairs', '\ud83d\ude00'.repeat(1024)],
  ['lone high surrogate', 'x'.repeat(1024) + '\ud800'],
  ['lone low surrogate', '\udfff' + 'x'.repeat(1024)],
  ['control characters', 'x'.repeat(1024) + '\x00\x01\x07\x0b\x0e\x1f'],
  ['literal escapes', '\\u0000\\ud800\\x3C'.repeat(128)],
] as const;

describe('long strings', () => {
  it.each(cases)(
    'preserves encoding and round-trips %s',
    async (_name, value) => {
      const expected = Array.from(value, char => escapes[char] ?? char).join(
        '',
      );
      expect(serializeString(value)).toBe(expected);
      expect(serialize(value)).toBe(`"${expected}"`);
      expect(deserialize(serialize(value))).toBe(value);
      expect(await serializeAsync(value)).toBe(`"${expected}"`);
      expect(fromJSON(toJSON(value))).toBe(value);
      expect(fromCrossJSON(toCrossJSON(value), { refs: new Map() })).toBe(
        value,
      );
    },
  );

  it('preserves every UTF-16 code unit inside long strings', () => {
    const padding = 'x'.repeat(1024);
    for (let code = 0; code <= 0xffff; code++) {
      const char = String.fromCharCode(code);
      expect(serializeString(padding + char)).toBe(
        padding + (escapes[char] ?? char),
      );
    }
  });

  it('escapes a long deferred SSR value', async () => {
    const value = '</script><!--"\\\n\u2028\u2029'.repeat(128);
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(value), {
        onSerialize(chunk) {
          expect(chunk).not.toContain('</script');
          chunks.push(chunk);
        },
        onDone: resolve,
        onError: reject,
      });
    });
    expect(chunks.join('')).toContain(serializeString(value));
  });

  it('round-trips long deferred server-function data', async () => {
    const value = JSON.stringify({
      items: new Array(100).fill('"\\\n'),
    });
    const refs = new Map();
    let restored: Promise<string> | undefined;
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(value), {
        onParse(node, initial) {
          const result = fromCrossJSON<Promise<string>>(node, { refs });
          if (initial) {
            restored = result;
          }
        },
        onDone: resolve,
        onError: reject,
      });
    });
    expect(await restored).toBe(value);
  });
});
