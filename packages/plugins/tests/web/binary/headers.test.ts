import { describe, expect, it } from 'vitest';
import HeadersPlugin from '../../../web/headers';
import { roundtrip } from './utils';

const PLUGINS = [HeadersPlugin];

function entries(headers: Headers): [string, string][] {
  const items: [string, string][] = [];
  headers.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}

describe('binary Headers', () => {
  it('supports Headers', async () => {
    const source = new Headers([
      ['content-type', 'text/plain'],
      ['x-custom', 'value'],
    ]);
    const { value } = await roundtrip<Headers>(source, PLUGINS);
    expect(value).toBeInstanceOf(Headers);
    expect(value.get('content-type')).toBe('text/plain');
    expect(value.get('x-custom')).toBe('value');
    expect(entries(value)).toEqual(entries(source));
  });

  it('supports empty Headers', async () => {
    const { value } = await roundtrip<Headers>(new Headers(), PLUGINS);
    expect(value).toBeInstanceOf(Headers);
    expect(entries(value)).toEqual([]);
  });

  it('normalises header names the same way', async () => {
    const source = new Headers([['X-MiXeD-CaSe', 'value']]);
    const { value } = await roundtrip<Headers>(source, PLUGINS);
    expect(value.get('x-mixed-case')).toBe('value');
    expect(entries(value)[0][0]).toBe('x-mixed-case');
  });

  it('joins repeated headers the same way', async () => {
    const source = new Headers();
    source.append('accept', 'text/html');
    source.append('accept', 'application/json');
    const { value } = await roundtrip<Headers>(source, PLUGINS);
    expect(value.get('accept')).toBe(source.get('accept'));
  });

  it('supports Headers nested in structures', async () => {
    const { value } = await roundtrip<{ headers: Headers }>(
      { headers: new Headers([['a', '1']]) },
      PLUGINS,
    );
    expect(value.headers).toBeInstanceOf(Headers);
    expect(value.headers.get('a')).toBe('1');
  });
});
