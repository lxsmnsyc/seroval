import { binary } from 'seroval';
import { describe, expect, it } from 'vitest';
import AbortSignalPlugin from '../../../web/abort-signal';
import DOMExceptionPlugin from '../../../web/dom-exception';
import FormDataPlugin from '../../../web/form-data';
import HeadersPlugin from '../../../web/headers';
import ReadableStreamPlugin from '../../../web/readable-stream';
import RequestPlugin from '../../../web/request';
import ResponsePlugin from '../../../web/response';
import URLPlugin from '../../../web/url';
import URLSearchParamsPlugin from '../../../web/url-search-params';
import { type AnyPlugin, startSerialize } from './utils';

/**
 * Models an attacker who controls the bytes: a stand-in plugin claims a real
 * plugin's tag and emits an arbitrary payload for it. The receiving side runs
 * the genuine plugin, so whatever it does with that payload is what a hostile
 * stream would trigger.
 */
function forge(tag: string, data: unknown): { sentinel: object; plugin: AnyPlugin } {
  const sentinel = {};
  const plugin = {
    tag,
    test: (value: unknown) => value === sentinel,
    parse: {},
    serialize: () => '',
    deserialize: () => undefined,
    binary: {
      serialize: () => data,
      deserialize: () => undefined,
    },
  };
  return { sentinel, plugin };
}

interface Delivery<T> {
  ok: boolean;
  value?: T;
  errors: unknown[];
}

async function deliver<T>(
  tag: string,
  data: unknown,
  plugins: AnyPlugin[],
): Promise<Delivery<T>> {
  const forged = forge(tag, data);
  const handle = startSerialize(forged.sentinel, [forged.plugin]);
  handle.done.catch(() => undefined);

  const errors: unknown[] = [];
  const received = binary.deserialize<T>({
    read: () => handle.transport.read(),
    plugins,
    onError(error) {
      errors.push(error);
    },
  });

  return await received.then(
    result => ({ ok: true, value: result.value, errors }),
    error => {
      errors.push(error);
      return { ok: false, errors };
    },
  );
}

describe('plugin binary hostile payloads', () => {
  describe('Headers', () => {
    it('refuses a header value carrying CRLF', async () => {
      const result = await deliver<Headers>(
        'seroval-plugins/web/Headers',
        { value: [['x-safe', 'ok\r\nx-smuggled: injected']] },
        [HeadersPlugin],
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(TypeError);
    });

    it('refuses a header name carrying CRLF', async () => {
      const result = await deliver<Headers>(
        'seroval-plugins/web/Headers',
        { value: [['x-a\r\nx-smuggled', 'value']] },
        [HeadersPlugin],
      );
      expect(result.ok).toBe(false);
    });

    it('does not pollute the prototype through a header name', async () => {
      const result = await deliver<Headers>(
        'seroval-plugins/web/Headers',
        { value: [['__proto__', 'polluted']] },
        [HeadersPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.get('__proto__')).toBe('polluted');
      expect(
        ({} as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    });

    it('rejects a payload that is not a HeadersInit', async () => {
      const result = await deliver<Headers>(
        'seroval-plugins/web/Headers',
        { value: [['only-one-element']] },
        [HeadersPlugin],
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('URL', () => {
    it('reconstructs dangerous schemes verbatim', async () => {
      // The plugin is not a URL validator. Pinning this makes it explicit that
      // consumers must check the scheme before navigating or fetching.
      const result = await deliver<URL>(
        'seroval-plugins/web/URL',
        { value: 'javascript:alert(document.cookie)' },
        [URLPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.protocol).toBe('javascript:');
    });

    it('reconstructs file URLs verbatim', async () => {
      const result = await deliver<URL>(
        'seroval-plugins/web/URL',
        { value: 'file:///etc/passwd' },
        [URLPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.pathname).toBe('/etc/passwd');
    });

    it('rejects a payload that is not a URL', async () => {
      const result = await deliver<URL>(
        'seroval-plugins/web/URL',
        { value: 'not a url' },
        [URLPlugin],
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(TypeError);
    });

    it('rejects a non-string payload', async () => {
      const result = await deliver<URL>(
        'seroval-plugins/web/URL',
        { value: { href: 'https://example.com' } },
        [URLPlugin],
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('URLSearchParams', () => {
    it('does not pollute the prototype', async () => {
      const result = await deliver<URLSearchParams>(
        'seroval-plugins/web/URLSearchParams',
        { value: '__proto__=polluted&constructor=nope' },
        [URLSearchParamsPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.get('__proto__')).toBe('polluted');
      expect(
        ({} as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    });
  });

  describe('FormData', () => {
    it('does not pollute the prototype through an entry key', async () => {
      const result = await deliver<FormData>(
        'seroval-plugins/web/FormData',
        { entries: [['__proto__', 'polluted']] },
        [FormDataPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.get('__proto__')).toBe('polluted');
      expect(
        ({} as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    });

    it('rejects entries that are not pairs', async () => {
      const result = await deliver<FormData>(
        'seroval-plugins/web/FormData',
        { entries: [null] },
        [FormDataPlugin],
      );
      expect(result.ok).toBe(false);
    });

    it('ignores a huge declared length on a non-array payload', async () => {
      // `length` is read straight off the payload; a bogus one must not spin.
      const result = await deliver<FormData>(
        'seroval-plugins/web/FormData',
        { entries: { length: 4294967295 } },
        [FormDataPlugin],
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('Response', () => {
    it('rejects an out-of-range status', async () => {
      const result = await deliver<Response>(
        'seroval-plugins/web/Response',
        { body: null, options: { status: 999 } },
        [ResponsePlugin],
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(RangeError);
    });

    it('rejects a body on a null-body status', async () => {
      const result = await deliver<Response>(
        'seroval-plugins/web/Response',
        { body: 'body', options: { status: 204 } },
        [ResponsePlugin],
      );
      expect(result.ok).toBe(false);
    });

    it('rejects a status text carrying CRLF', async () => {
      const result = await deliver<Response>(
        'seroval-plugins/web/Response',
        { body: null, options: { status: 200, statusText: 'OK\r\nEvil: 1' } },
        [ResponsePlugin],
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('Request', () => {
    it('rejects an unparsable url', async () => {
      const result = await deliver<Request>(
        'seroval-plugins/web/Request',
        { url: 'not a url', options: {} },
        [RequestPlugin],
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(TypeError);
    });

    it('rejects an invalid method', async () => {
      const result = await deliver<Request>(
        'seroval-plugins/web/Request',
        { url: 'http://localhost/', options: { method: 'BAD METHOD' } },
        [RequestPlugin],
      );
      expect(result.ok).toBe(false);
    });

    it('reconstructs internal hosts verbatim', async () => {
      // Deserializing is not fetching: the plugin must not silently rewrite
      // the target, and callers own the SSRF decision.
      const result = await deliver<Request>(
        'seroval-plugins/web/Request',
        { url: 'http://169.254.169.254/latest/meta-data/', options: {} },
        [RequestPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.url).toBe('http://169.254.169.254/latest/meta-data/');
    });
  });

  describe('ReadableStream', () => {
    it('rejects a payload that is not a Stream', async () => {
      const result = await deliver<ReadableStream>(
        'seroval/plugins/web/ReadableStream',
        { stream: { not: 'a stream' } },
        [ReadableStreamPlugin],
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(TypeError);
    });

    it('rejects a missing stream', async () => {
      const result = await deliver<ReadableStream>(
        'seroval/plugins/web/ReadableStream',
        {},
        [ReadableStreamPlugin],
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('AbortSignal', () => {
    it('accepts an attacker-chosen abort reason', async () => {
      const result = await deliver<AbortSignal>(
        'seroval-plugins/web/AbortSignal',
        { reason: 'forged' },
        [AbortSignalPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.aborted).toBe(true);
      expect(result.value?.reason).toBe('forged');
    });

    it('rejects a payload with neither reason nor controller', async () => {
      const result = await deliver<AbortSignal>(
        'seroval-plugins/web/AbortSignal',
        {},
        [AbortSignalPlugin],
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toBeInstanceOf(TypeError);
    });

    it('rejects a controller that is not a thenable', async () => {
      const result = await deliver<AbortSignal>(
        'seroval-plugins/web/AbortSignal',
        { controller: 'not a promise' },
        [AbortSignalPlugin],
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('DOMException', () => {
    it('reconstructs an attacker-chosen name and message', async () => {
      const result = await deliver<DOMException>(
        'seroval-plugins/web/DOMException',
        { name: 'SecurityError', message: 'forged' },
        [DOMExceptionPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.name).toBe('SecurityError');
      expect(result.value?.message).toBe('forged');
    });

    it('coerces a non-string name instead of throwing', async () => {
      const result = await deliver<DOMException>(
        'seroval-plugins/web/DOMException',
        { name: 42, message: 'forged' },
        [DOMExceptionPlugin],
      );
      expect(result.ok).toBe(true);
      expect(result.value?.name).toBe('42');
    });
  });

  describe('plugin resolution', () => {
    it('rejects a payload whose tag has no plugin registered', async () => {
      const result = await deliver<unknown>(
        'seroval-plugins/web/URL',
        { value: 'https://example.com' },
        [HeadersPlugin],
      );
      expect(result.ok).toBe(false);
      expect(String(result.errors[0])).toContain('seroval-plugins/web/URL');
    });

    it('rejects a payload shaped for a different plugin', async () => {
      const result = await deliver<Headers>(
        'seroval-plugins/web/Headers',
        { value: 'https://example.com' },
        [HeadersPlugin, URLPlugin],
      );
      expect(result.ok).toBe(false);
    });
  });
});
