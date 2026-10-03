import { describe, expect, it } from 'vitest';
import { roundtrip } from './utils';

describe('binary Map', () => {
  it('supports Map', async () => {
    const { value } = await roundtrip<Map<string, number>>(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    expect(value).toBeInstanceOf(Map);
    expect(value.size).toBe(2);
    expect(value.get('a')).toBe(1);
    expect(value.get('b')).toBe(2);
  });

  it('supports empty Map', async () => {
    const { value } = await roundtrip<Map<unknown, unknown>>(new Map());
    expect(value).toBeInstanceOf(Map);
    expect(value.size).toBe(0);
  });

  it('preserves insertion order', async () => {
    const source = new Map<string, number>([
      ['z', 1],
      ['a', 2],
      ['m', 3],
    ]);
    const { value } = await roundtrip<Map<string, number>>(source);
    expect([...value.keys()]).toEqual(['z', 'a', 'm']);
  });

  it('supports object keys', async () => {
    const key = { id: 1 };
    const { value } = await roundtrip<{
      map: Map<object, string>;
      key: object;
    }>({ map: new Map([[key, 'value']]), key });
    expect(value.map.get(value.key)).toBe('value');
  });

  it('supports exotic keys and values', async () => {
    const source = new Map<unknown, unknown>([
      [1n, new Date(0)],
      [Number.NaN, /pattern/g],
      [undefined, null],
    ]);
    const { value } = await roundtrip<Map<unknown, unknown>>(source);
    expect(value.get(1n)).toBeInstanceOf(Date);
    expect(value.get(Number.NaN)).toBeInstanceOf(RegExp);
    expect(value.has(undefined)).toBe(true);
    expect(value.get(undefined)).toBe(null);
  });

  it('supports self-referencing Map', async () => {
    const source = new Map<string, unknown>();
    source.set('self', source);
    const { value } = await roundtrip<Map<string, unknown>>(source);
    expect(value.get('self')).toBe(value);
  });

  it('supports a Map used as its own key', async () => {
    const source = new Map<unknown, unknown>();
    source.set(source, source);
    const { value } = await roundtrip<Map<unknown, unknown>>(source);
    expect(value.get(value)).toBe(value);
  });

  it('supports nested Maps', async () => {
    const { value } = await roundtrip<Map<string, Map<string, string>>>(
      new Map([['outer', new Map([['inner', 'deep']])]]),
    );
    expect(value.get('outer')?.get('inner')).toBe('deep');
  });
});
