import { describe, expect, it } from 'vitest';
import URLPlugin from '../../../web/url';
import URLSearchParamsPlugin from '../../../web/url-search-params';
import { roundtrip } from './utils';

const PLUGINS = [URLPlugin];

describe('binary URL', () => {
  it('supports URL', async () => {
    const source = new URL('https://example.com/path?query=1#hash');
    const { value } = await roundtrip<URL>(source, PLUGINS);
    expect(value).toBeInstanceOf(URL);
    expect(value.href).toBe(source.href);
    expect(value.pathname).toBe('/path');
    expect(value.searchParams.get('query')).toBe('1');
    expect(value.hash).toBe('#hash');
  });

  it('supports URLs with credentials and ports', async () => {
    const source = new URL('https://user:pass@example.com:8443/a/b');
    const { value } = await roundtrip<URL>(source, PLUGINS);
    expect(value.href).toBe(source.href);
    expect(value.port).toBe('8443');
    expect(value.username).toBe('user');
  });

  it('supports non-http schemes', async () => {
    const source = new URL('mailto:someone@example.com');
    const { value } = await roundtrip<URL>(source, PLUGINS);
    expect(value.protocol).toBe('mailto:');
    expect(value.href).toBe(source.href);
  });

  it('supports URLs nested in structures', async () => {
    const { value } = await roundtrip<{ links: URL[] }>(
      { links: [new URL('https://a.example'), new URL('https://b.example')] },
      PLUGINS,
    );
    expect(value.links[0]).toBeInstanceOf(URL);
    expect(value.links[1].hostname).toBe('b.example');
  });

  it('preserves identity of a repeated URL', async () => {
    const url = new URL('https://example.com/');
    const { value } = await roundtrip<URL[]>([url, url], PLUGINS);
    expect(value[0]).toBe(value[1]);
  });
});

describe('binary URLSearchParams', () => {
  const params = [URLSearchParamsPlugin];

  it('supports URLSearchParams', async () => {
    const source = new URLSearchParams('a=1&b=2&b=3');
    const { value } = await roundtrip<URLSearchParams>(source, params);
    expect(value).toBeInstanceOf(URLSearchParams);
    expect(value.toString()).toBe(source.toString());
    expect(value.getAll('b')).toEqual(['2', '3']);
  });

  it('supports empty URLSearchParams', async () => {
    const { value } = await roundtrip<URLSearchParams>(
      new URLSearchParams(),
      params,
    );
    expect(value.toString()).toBe('');
  });

  it('supports values needing escapes', async () => {
    const source = new URLSearchParams();
    source.set('key with spaces', 'value&with=specials');
    source.set('unicode', '👋');
    const { value } = await roundtrip<URLSearchParams>(source, params);
    expect(value.get('key with spaces')).toBe('value&with=specials');
    expect(value.get('unicode')).toBe('👋');
  });
});
