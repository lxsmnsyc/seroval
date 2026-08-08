import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

function createNullObject(
  source: Record<string, unknown>,
): Record<string, unknown> {
  return Object.assign(Object.create(null) as Record<string, unknown>, source);
}

describe('binary null constructor', () => {
  it('supports null-prototype objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      createNullObject({ hello: 'world' }),
    );
    expect(Object.getPrototypeOf(value)).toBe(null);
    expect(value.hello).toBe('world');
  });

  it('supports empty null-prototype objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      Object.create(null) as Record<string, unknown>,
    );
    expect(Object.getPrototypeOf(value)).toBe(null);
    expect(Object.keys(value)).toEqual([]);
  });

  it('supports nested null-prototype objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      createNullObject({ nested: createNullObject({ deep: true }) }),
    );
    const nested = value.nested as Record<string, unknown>;
    expect(Object.getPrototypeOf(nested)).toBe(null);
    expect(nested.deep).toBe(true);
  });

  it('supports self-referencing null-prototype objects', async () => {
    const source = Object.create(null) as Record<string, unknown>;
    source.self = source;
    const { value } = await roundtrip<Record<string, unknown>>(source);
    expect(value.self).toBe(value);
  });
});
