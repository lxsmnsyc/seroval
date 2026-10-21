import { fromJSON, type Plugin, toJSONAsync } from 'seroval';
import { describe, expect, it } from 'vitest';
import BlobPlugin from '../../web/blob';
import CustomEventPlugin from '../../web/custom-event';
import DOMExceptionPlugin from '../../web/dom-exception';
import EventPlugin from '../../web/event';
import FilePlugin from '../../web/file';
import RequestPlugin from '../../web/request';
import URLPlugin from '../../web/url';
import URLSearchParamsPlugin from '../../web/url-search-params';

// A plugin node's fields come from the wire. A field that should be a string
// or a buffer must be checked before it reaches a Web constructor, since an
// object would otherwise be coerced or read as a different kind of input.
const OBJECT_NODE = { t: 10, i: 999, p: { k: [], v: [] }, o: 0 };

const CASES: [string, Plugin<any, any>, () => unknown, string][] = [
  ['URL', URLPlugin, () => new URL('https://example.com'), 'value'],
  [
    'URLSearchParams',
    URLSearchParamsPlugin,
    () => new URLSearchParams('a=b'),
    'value',
  ],
  ['Request', RequestPlugin, () => new Request('https://example.com'), 'url'],
  ['DOMException message', DOMExceptionPlugin, () => new DOMException('a'), 'message'],
  ['DOMException name', DOMExceptionPlugin, () => new DOMException('a'), 'name'],
  ['Event', EventPlugin, () => new Event('a'), 'type'],
  ['CustomEvent', CustomEventPlugin, () => new CustomEvent('a'), 'type'],
  ['Blob type', BlobPlugin, () => new Blob(['a']), 'type'],
  ['Blob buffer', BlobPlugin, () => new Blob(['a']), 'buffer'],
  ['File name', FilePlugin, () => new File(['a'], 'a.txt'), 'name'],
  ['File buffer', FilePlugin, () => new File(['a'], 'a.txt'), 'buffer'],
];

describe('plugin field validation', () => {
  it.each(CASES)('rejects an object as the %s', async (_, plugin, create, field) => {
    const json = await toJSONAsync(create(), { plugins: [plugin] });
    (json.t as unknown as { s: Record<string, unknown> }).s[field] = OBJECT_NODE;
    expect(() => fromJSON(json, { plugins: [plugin] })).toThrow();
  });

  it.each(CASES)('still accepts a valid %s', async (_, plugin, create) => {
    const json = await toJSONAsync(create(), { plugins: [plugin] });
    expect(() => fromJSON(json, { plugins: [plugin] })).not.toThrow();
  });
});
