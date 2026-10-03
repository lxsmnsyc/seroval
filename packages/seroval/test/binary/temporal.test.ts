import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Temporal', () => {
  it('supports Temporal.Instant', async () => {
    const source = Temporal.Instant.from('2023-06-15T12:34:56.789Z');
    const { value } = await roundtrip<Temporal.Instant>(source);
    expect(value).toBeInstanceOf(Temporal.Instant);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.Duration', async () => {
    const source = Temporal.Duration.from('P1Y2M3DT4H5M6S');
    const { value } = await roundtrip<Temporal.Duration>(source);
    expect(value).toBeInstanceOf(Temporal.Duration);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.PlainDate', async () => {
    const source = Temporal.PlainDate.from('2023-06-15');
    const { value } = await roundtrip<Temporal.PlainDate>(source);
    expect(value).toBeInstanceOf(Temporal.PlainDate);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.PlainDateTime', async () => {
    const source = Temporal.PlainDateTime.from('2023-06-15T12:34:56');
    const { value } = await roundtrip<Temporal.PlainDateTime>(source);
    expect(value).toBeInstanceOf(Temporal.PlainDateTime);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.PlainMonthDay', async () => {
    const source = Temporal.PlainMonthDay.from('06-15');
    const { value } = await roundtrip<Temporal.PlainMonthDay>(source);
    expect(value).toBeInstanceOf(Temporal.PlainMonthDay);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.PlainTime', async () => {
    const source = Temporal.PlainTime.from('12:34:56');
    const { value } = await roundtrip<Temporal.PlainTime>(source);
    expect(value).toBeInstanceOf(Temporal.PlainTime);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.PlainYearMonth', async () => {
    const source = Temporal.PlainYearMonth.from('2023-06');
    const { value } = await roundtrip<Temporal.PlainYearMonth>(source);
    expect(value).toBeInstanceOf(Temporal.PlainYearMonth);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal.ZonedDateTime', async () => {
    const source = Temporal.ZonedDateTime.from(
      '2023-06-15T12:34:56+09:00[Asia/Tokyo]',
    );
    const { value } = await roundtrip<Temporal.ZonedDateTime>(source);
    expect(value).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(String(value)).toBe(String(source));
  });

  it('supports Temporal values inside structures', async () => {
    const source = {
      when: Temporal.PlainDate.from('2024-01-01'),
      how_long: Temporal.Duration.from('PT30M'),
    };
    const { value } = await roundtrip<typeof source>(source);
    expect(String(value.when)).toBe('2024-01-01');
    expect(String(value.how_long)).toBe('PT30M');
  });

  it('preserves identity of a repeated Temporal value', async () => {
    const instant = Temporal.Instant.from('2023-06-15T12:34:56.789Z');
    const { value } = await roundtrip<Temporal.Instant[]>([instant, instant]);
    expect(value[0]).toBe(value[1]);
  });
});
