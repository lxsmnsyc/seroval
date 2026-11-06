import { type Plugin, type SerovalNode, fromCrossJSON, toCrossJSONAsync } from 'seroval';
import { describe, expect, it } from 'vitest';
import BlobPlugin from '../../web/blob';
import FilePlugin from '../../web/file';
import FormDataPlugin from '../../web/form-data';
import HeadersPlugin from '../../web/headers';
import ReadableStreamPlugin from '../../web/readable-stream';
import RequestPlugin from '../../web/request';
import ResponsePlugin from '../../web/response';

type Node = SerovalNode & { i?: number; a?: Node[]; s?: Record<string, Node>; c?: string };

// The parser builds a fresh buffer, entry list, Headers or Stream for every
// value, so two plugin values never share one. Input that makes them share
// one would make every plugin value copy or subscribe to it again.
function share(root: Node, field: string): Node {
  const [first, second] = root.a as Node[];
  const target = (first.s as Record<string, Node>)[field];
  (second.s as Record<string, Node>)[field] = { t: 4, i: target.i } as Node;
  return root;
}

function shareNested(root: Node, field: string, tag: string): Node {
  const [first, second] = root.a as Node[];
  let target: Node | undefined;
  const find = (node: unknown): void => {
    if (node && typeof node === 'object') {
      const current = node as Node;
      if (!target && current.t === 25 && current.c === tag) {
        target = current;
        return;
      }
      for (const value of Object.values(current)) {
        find(value);
      }
    }
  };
  find(first.s);
  const replace = (node: Record<string, unknown>): void => {
    for (const key of Object.keys(node)) {
      const value = node[key] as Node | undefined;
      if (value && typeof value === 'object') {
        if (value.t === 25 && value.c === tag) {
          node[key] = { t: 4, i: (target as Node).i };
        } else {
          replace(value as unknown as Record<string, unknown>);
        }
      }
    }
  };
  replace((second.s as Record<string, Node>)[field] as unknown as Record<string, unknown>);
  return root;
}

function stream(): ReadableStream<string> {
  return new ReadableStream({
    start(controller): void {
      controller.enqueue('a');
      controller.close();
    },
  });
}

const CASES: [string, Plugin<any, any>[], () => unknown, (root: Node) => Node][] = [
  ['Blob buffer', [BlobPlugin], () => new Blob(['a']), (root) => share(root, 'buffer')],
  ['File buffer', [FilePlugin], () => new File(['a'], 'a.txt'), (root) => share(root, 'buffer')],
  ['Headers entries', [HeadersPlugin], () => new Headers({ a: 'b' }), (root) => share(root, 'value')],
  [
    'FormData entries',
    [FormDataPlugin],
    () => {
      const form = new FormData();
      form.append('a', 'b');
      return form;
    },
    (root) => share(root, 'entries'),
  ],
  [
    'Response body',
    [ResponsePlugin],
    () => new Response('a'),
    (root) => share(root, 'body'),
  ],
  [
    'Request headers',
    [RequestPlugin],
    () => new Request('https://example.com', { headers: { a: 'b' } }),
    (root) => shareNested(root, 'options', 'seroval-plugins/web/Headers'),
  ],
  [
    'ReadableStream source',
    [ReadableStreamPlugin],
    () => stream(),
    (root) => share(root, 'stream'),
  ],
];

describe('values shared between plugin values', () => {
  it.each(CASES)('rejects a shared %s', async (_, plugins, create, tamper) => {
    const json = (await toCrossJSONAsync([create(), create()], { plugins })) as Node;
    expect(() => fromCrossJSON(tamper(json), { plugins, refs: new Map() })).toThrow();
  });

  it.each(CASES)('still accepts two separate %s values', async (_, plugins, create) => {
    const json = await toCrossJSONAsync([create(), create()], { plugins });
    expect(() => fromCrossJSON(json, { plugins, refs: new Map() })).not.toThrow();
  });
});
