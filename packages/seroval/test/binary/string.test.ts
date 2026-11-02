import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary string', () => {
  it('supports strings', async () => {
    const { value } = await roundtrip<string>('Hello World');
    expect(value).toBe('Hello World');
  });

  it('supports empty strings', async () => {
    const { value } = await roundtrip<string>('');
    expect(value).toBe('');
  });

  it('supports multibyte characters', async () => {
    const source = 'ハローワールド、こんにちは';
    const { value } = await roundtrip<string>(source);
    expect(value).toBe(source);
  });

  it('supports surrogate pairs', async () => {
    const source = '👋🌍 seroval 🧬';
    const { value } = await roundtrip<string>(source);
    expect(value).toBe(source);
  });

  it('supports control characters', async () => {
    const source = 'line\nbreak\ttab\0null\\backslash"quote';
    const { value } = await roundtrip<string>(source);
    expect(value).toBe(source);
  });

  it('supports strings longer than a single chunk', async () => {
    const source = 'a'.repeat(100_000);
    const { value } = await roundtrip<string>(source);
    expect(value).toBe(source);
    expect(value.length).toBe(100_000);
  });

  // UTF-8 cannot hold a lone surrogate, so these strings are sent as UTF-16.
  it.each([
    ['a lone high surrogate', '\ud800'],
    ['a lone low surrogate', 'a\udc00b'],
    ['a reversed pair', '\udc00\ud800'],
    ['a high surrogate at the end', 'abc\ud83d'],
    ['a lone surrogate next to a pair', '\ud83d\ude00\ud800ハロー'],
  ])('supports %s', async (_name, source) => {
    const { value } = await roundtrip<string>(source);
    expect(value).toBe(source);
  });

  it('supports a long string with a lone surrogate', async () => {
    const source = 'ハロー'.repeat(10_000) + '\ud800' + 'a'.repeat(10_000);
    const { value } = await roundtrip<string>(source);
    expect(value).toBe(source);
  });

  it('supports a lone surrogate in an object key', async () => {
    const { value } = await roundtrip<Record<string, string>>({ '\udfff': '\ud800' });
    expect(Object.keys(value)).toEqual(['\udfff']);
    expect(value['\udfff']).toBe('\ud800');
  });

  it('deduplicates repeated strings', async () => {
    const { value } = await roundtrip<string[]>(['same', 'same']);
    expect(value).toEqual(['same', 'same']);
  });
});
