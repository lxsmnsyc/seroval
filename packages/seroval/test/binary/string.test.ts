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

  it('deduplicates repeated strings', async () => {
    const { value } = await roundtrip<string[]>(['same', 'same']);
    expect(value).toEqual(['same', 'same']);
  });
});
