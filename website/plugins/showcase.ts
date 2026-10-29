import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Seroval from 'seroval';
import type * as SerovalBinary from 'seroval/binary';
import { codeFrame, highlight } from './highlight.ts';

export interface ShowcaseExample {
  id: string;
  label: string;
  description: string;
  input: string;
  output: string;
}

const SEROVAL = path.join(import.meta.dirname, '../../packages/seroval/dist/index.js');
const SEROVAL_BINARY = path.join(import.meta.dirname, '../../packages/seroval/dist/binary.js');

const USER_SOURCE = `const user = {
  name: 'Ada',
  joined: new Date('2026-01-01'),
  roles: new Set(['admin', 'editor']),
  prefs: new Map([['theme', 'dark']]),
};
user.self = user;`;

// Must build the same value as USER_SOURCE.
function createUser(): Record<string, unknown> {
  const user: Record<string, unknown> = {
    name: 'Ada',
    joined: new Date('2026-01-01'),
    roles: new Set(['admin', 'editor']),
    prefs: new Map([['theme', 'dark']]),
  };
  user.self = user;
  return user;
}

const HEX_ROW = 16;

// One row per 16 bytes: the offset, the bytes in hex, then printable ASCII.
function hexDump(bytes: Uint8Array): string {
  const rows: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += HEX_ROW) {
    const row = bytes.subarray(offset, offset + HEX_ROW);
    let hex = '';
    let ascii = '';
    for (const byte of row) {
      hex += byte.toString(16).padStart(2, '0') + ' ';
      ascii += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.';
    }
    rows.push(`${offset.toString(16).padStart(6, '0')}  ${hex.padEnd(HEX_ROW * 3)} ${ascii}`);
  }
  return rows.join('\n');
}

/**
 * Serializes the home page examples with the workspace build of seroval, so
 * the output on the page is always what the library produces.
 */
export async function renderShowcase(): Promise<ShowcaseExample[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A dynamic import of a computed path is untyped.
  const seroval = (await import(pathToFileURL(SEROVAL).href)) as typeof Seroval;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A dynamic import of a computed path is untyped.
  const binary = (await import(pathToFileURL(SEROVAL_BINARY).href)) as typeof SerovalBinary;

  const javascript = seroval.serialize(createUser());
  const json = JSON.stringify(seroval.toJSON(createUser()), null, 2);

  const chunks: string[] = [];
  await new Promise<void>((resolve, reject) => {
    seroval.crossSerializeStream(
      {
        user: 'Ada',
        posts: new Promise((done) => {
          setTimeout(() => {
            done(['Hello', 'World']);
          }, 10);
        }),
      },
      {
        scopeId: 'page',
        onSerialize(chunk: string) {
          chunks.push(chunk);
        },
        onDone: resolve,
        onError: reject,
      },
    );
  });

  const bytes: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    binary.serialize(createUser(), {
      refs: new Map(),
      onSerialize(chunk: Uint8Array) {
        bytes.push(chunk);
      },
      onDone: resolve,
      onError: reject,
    });
  });
  const binarySize = bytes.reduce((total, chunk) => total + chunk.length, 0);

  const examples = [
    {
      id: 'javascript',
      label: 'JavaScript',
      description: 'serialize returns an expression that rebuilds the value.',
      input: `${USER_SOURCE}\n\nserialize(user);`,
      output: javascript,
      outputLabel: 'Output',
      outputLang: 'js',
    },
    {
      id: 'json',
      label: 'JSON',
      description: 'toJSON returns a tree that fromJSON decodes without eval.',
      input: `${USER_SOURCE}\n\nJSON.stringify(toJSON(user));`,
      output: json,
      outputLabel: 'Output',
      outputLang: 'json',
    },
    {
      id: 'streaming',
      label: 'Streaming',
      description: 'crossSerializeStream sends each value as soon as it settles.',
      input: `crossSerializeStream(
  {
    user: 'Ada',
    posts: fetchPosts(), // a Promise
  },
  {
    scopeId: 'page',
    onSerialize(chunk) {
      response.write(\`<script>\${chunk}</script>\`);
    },
  },
);`,
      output: chunks.map((chunk, i) => `// Chunk ${i + 1}\n${chunk}`).join('\n\n'),
      outputLabel: `Output · ${chunks.length} chunks`,
      outputLang: 'js',
    },
    {
      id: 'binary',
      label: 'Binary',
      description:
        'binary.serialize sends Uint8Array chunks that binary.deserialize decodes without eval.',
      input: `${USER_SOURCE}

binary.serialize(user, {
  refs: new Map(),
  onSerialize(bytes) {
    socket.send(bytes); // a Uint8Array
  },
  onDone() {},
  onError(error) {},
});`,
      output: bytes.map(hexDump).join('\n\n'),
      outputLabel: `Output · ${binarySize} bytes`,
      outputLang: 'text',
    },
  ];

  return examples.map((example) => ({
    id: example.id,
    label: example.label,
    description: example.description,
    input: codeFrame(highlight(example.input, 'js'), 'Input'),
    output: codeFrame(highlight(example.output, example.outputLang), example.outputLabel),
  }));
}
