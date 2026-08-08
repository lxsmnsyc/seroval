import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary RegExp', () => {
  it('supports RegExp', async () => {
    const { value } = await roundtrip<RegExp>(/[a-z0-9]+/i);
    expect(value).toBeInstanceOf(RegExp);
    expect(value.source).toBe('[a-z0-9]+');
    expect(value.flags).toBe('i');
    expect(value.test('Hello')).toBe(true);
  });

  it('supports every flag', async () => {
    const { value } = await roundtrip<RegExp>(/x/dgimsuy);
    expect(value.flags).toBe([...'dgimsuy'].sort().join(''));
  });

  it('supports escaped sources', async () => {
    const source = /\d+\.\d+\/\s*"quoted"/;
    const { value } = await roundtrip<RegExp>(source);
    expect(value.source).toBe(source.source);
    expect(value.test('12.5/ "quoted"')).toBe(true);
  });

  it('supports named groups', async () => {
    const { value } = await roundtrip<RegExp>(/(?<year>\d{4})-(?<month>\d{2})/);
    expect(value.exec('2024-05')?.groups).toEqual({
      year: '2024',
      month: '05',
    });
  });

  it('supports empty RegExp', async () => {
    const { value } = await roundtrip<RegExp>(new RegExp(''));
    expect(value.source).toBe('(?:)');
  });

  it('preserves identity of a repeated RegExp', async () => {
    const pattern = /shared/g;
    const { value } = await roundtrip<RegExp[]>([pattern, pattern]);
    expect(value[0]).toBe(value[1]);
  });
});
