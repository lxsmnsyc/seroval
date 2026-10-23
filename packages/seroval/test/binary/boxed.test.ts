import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary boxed values', () => {
  it('supports boxed numbers', async () => {
    const { value } = await roundtrip<Number>(Object(0xbeef));
    expect(value).toBeInstanceOf(Number);
    expect(value.valueOf()).toBe(0xbeef);
  });

  it('supports boxed strings', async () => {
    const { value } = await roundtrip<String>(Object('Hello World'));
    expect(value).toBeInstanceOf(String);
    expect(value.valueOf()).toBe('Hello World');
  });

  it('supports boxed booleans', async () => {
    const { value } = await roundtrip<Boolean>(Object(true));
    expect(value).toBeInstanceOf(Boolean);
    expect(value.valueOf()).toBe(true);
  });

  it('supports boxed bigints', async () => {
    const { value } = await roundtrip<BigInt>(Object(9007199254740991n));
    expect(value).toBeInstanceOf(BigInt);
    expect(value.valueOf()).toBe(9007199254740991n);
  });

  it('supports boxed NaN', async () => {
    const { value } = await roundtrip<Number>(Object(Number.NaN));
    expect(value).toBeInstanceOf(Number);
    expect(value.valueOf()).toBeNaN();
  });

  it('keeps boxed values distinct from primitives', async () => {
    const { value } = await roundtrip<[Number, number]>([Object(1), 1]);
    expect(value[0]).toBeInstanceOf(Number);
    expect(typeof value[1]).toBe('number');
    expect(value[0]).not.toBe(value[1]);
  });

  it('preserves identity of a repeated boxed value', async () => {
    const boxed = Object('shared');
    const { value } = await roundtrip<[String, String]>([boxed, boxed]);
    expect(value[0]).toBe(value[1]);
  });
});
