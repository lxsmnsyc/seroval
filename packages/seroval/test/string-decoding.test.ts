import { describe, expect, it } from 'vitest';
import { fromCrossJSON, fromJSON, toCrossJSON, toJSON } from '../src';
import { deserializeString, serializeString } from '../src/core/string';

describe('string decoding', () => {
  it.each([
    '',
    'hello',
    'x'.repeat(4096),
    'caf\u00e9 \u4e2d\u6587 \ud83d\ude00',
    '\ud800\udfff\ud800',
    '\x00\x01\x0b\x1f',
    '"\\\n\r\b\t\f<\u2028\u2029',
    '\\n\\u2028\\x3C',
  ])('round-trips %j through JSON modes', value => {
    expect(fromJSON(toJSON(value))).toBe(value);
    expect(fromCrossJSON(toCrossJSON(value), {})).toBe(value);
  });

  it.each([
    ['\\n', '\n'],
    ['\\\\n', '\\n'],
    ['\\\\\\n', '\\\n'],
    ['\\x3C\\u2028\\u2029', '<\u2028\u2029'],
    ['\\x3c\\u0041\\z\\', '\\x3c\\u0041\\z\\'],
    ['x'.repeat(4096) + '\\n', 'x'.repeat(4096) + '\n'],
  ])('decodes %j without interpreting additional escapes', (input, output) => {
    expect(deserializeString(input)).toBe(output);
  });

  it('preserves every UTF-16 code unit', () => {
    for (let code = 0; code <= 0xffff; code++) {
      const value = String.fromCharCode(code);
      expect(deserializeString(serializeString(value))).toBe(value);
    }
  });

  it('decodes mixed property keys and values', () => {
    const input = {
      ordinary: 'text',
      'quote"': 'line\nbreak',
      'literal\\n': '<script>\u2028',
      unicode: '\ud800\ud83d\ude00',
    };
    expect(fromJSON(toJSON(input))).toEqual(input);
    expect(fromCrossJSON(toCrossJSON(input), {})).toEqual(input);
  });

  it('retains replacement behavior for non-primitive inputs', () => {
    // Some node fields reach the helper without String coercion.
    const boxed = new Object('hello') as string;
    expect(deserializeString(boxed)).toBe('hello');
    const custom = { replace: () => 'replacement' } as unknown as string;
    expect(deserializeString(custom)).toBe('replacement');
  });
});
