import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Date', () => {
  it('supports Date', async () => {
    const source = new Date('2023-06-15T12:34:56.789Z');
    const { value } = await roundtrip<Date>(source);
    expect(value).toBeInstanceOf(Date);
    expect(value.toISOString()).toBe(source.toISOString());
    expect(value.getTime()).toBe(source.getTime());
  });

  it('supports the epoch', async () => {
    const { value } = await roundtrip<Date>(new Date(0));
    expect(value.getTime()).toBe(0);
  });

  it('supports dates before the epoch', async () => {
    const source = new Date('1969-07-20T20:17:00.000Z');
    const { value } = await roundtrip<Date>(source);
    expect(value.getTime()).toBe(source.getTime());
  });

  it('supports invalid dates', async () => {
    const { value } = await roundtrip<Date>(new Date(Number.NaN));
    expect(value).toBeInstanceOf(Date);
    expect(value.getTime()).toBeNaN();
  });

  it('preserves identity of a repeated Date', async () => {
    const date = new Date(1000);
    const { value } = await roundtrip<Date[]>([date, date]);
    expect(value[0]).toBe(value[1]);
  });
});
