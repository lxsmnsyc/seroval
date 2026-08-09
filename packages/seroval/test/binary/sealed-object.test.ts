import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary sealed object', () => {
  it('supports sealed objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      Object.seal({ hello: 'world' }),
    );
    expect(Object.isSealed(value)).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
    expect(value.hello).toBe('world');
  });

  it('supports non-extensible objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      Object.preventExtensions({ hello: 'world' }),
    );
    expect(Object.isExtensible(value)).toBe(false);
    expect(Object.isSealed(value)).toBe(false);
    expect(value.hello).toBe('world');
  });

  it('keeps plain objects extensible', async () => {
    const { value } = await roundtrip<Record<string, unknown>>({
      hello: 'world',
    });
    expect(Object.isExtensible(value)).toBe(true);
    expect(Object.isSealed(value)).toBe(false);
  });

  it('seals nested objects independently', async () => {
    const { value } = await roundtrip<{
      sealed: Record<string, unknown>;
      loose: Record<string, unknown>;
    }>({
      sealed: Object.seal({ a: 1 }),
      loose: { b: 2 },
    });
    expect(Object.isSealed(value.sealed)).toBe(true);
    expect(Object.isSealed(value.loose)).toBe(false);
  });
});
