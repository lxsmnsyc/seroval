import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary frozen object', () => {
  it('supports frozen objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      Object.freeze({ hello: 'world', count: 1 }),
    );
    expect(Object.isFrozen(value)).toBe(true);
    expect(value).toEqual({ hello: 'world', count: 1 });
  });

  it('supports empty frozen objects', async () => {
    const { value } = await roundtrip<Record<string, unknown>>(
      Object.freeze({}),
    );
    expect(Object.isFrozen(value)).toBe(true);
  });

  it('freezes only the marked objects', async () => {
    const { value } = await roundtrip<{
      frozen: Record<string, unknown>;
      loose: Record<string, unknown>;
    }>({
      frozen: Object.freeze({ a: 1 }),
      loose: { b: 2 },
    });
    expect(Object.isFrozen(value.frozen)).toBe(true);
    expect(Object.isFrozen(value.loose)).toBe(false);
  });

  it('freezes after every property is assigned', async () => {
    const nested = { deep: true };
    const { value } = await roundtrip<Record<string, unknown>>(
      Object.freeze({ nested, count: 2 }),
    );
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.count).toBe(2);
    expect(value.nested).toEqual({ deep: true });
  });

  it('supports frozen self-referencing objects', async () => {
    interface Cyclic {
      self?: Cyclic;
    }
    const source: Cyclic = {};
    source.self = source;
    Object.freeze(source);
    const { value } = await roundtrip<Cyclic>(source);
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.self).toBe(value);
  });
});
