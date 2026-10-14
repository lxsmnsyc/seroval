import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { codeFrame, highlight } from './highlight.ts';

export interface ShowcaseExample {
  id: string;
  label: string;
  description: string;
  input: string;
  output: string;
}

const SEROVAL = path.join(
  import.meta.dirname,
  '../../packages/seroval/dist/index.js',
);

const USER_SOURCE = `const user = {
  name: 'Ada',
  joined: new Date('2026-01-01'),
  roles: new Set(['admin', 'editor']),
  prefs: new Map([['theme', 'dark']]),
};
user.self = user;`;

// Must build the same value as USER_SOURCE.
function createUser() {
  const user: Record<string, unknown> = {
    name: 'Ada',
    joined: new Date('2026-01-01'),
    roles: new Set(['admin', 'editor']),
    prefs: new Map([['theme', 'dark']]),
  };
  user.self = user;
  return user;
}

/**
 * Serializes the home page examples with the workspace build of seroval, so
 * the output on the page is always what the library produces.
 */
export async function renderShowcase(): Promise<ShowcaseExample[]> {
  const seroval = await import(pathToFileURL(SEROVAL).href);

  const javascript = seroval.serialize(createUser());
  const json = JSON.stringify(seroval.toJSON(createUser()), null, 2);

  const chunks: string[] = [];
  await new Promise<void>((resolve, reject) => {
    seroval.crossSerializeStream(
      {
        user: 'Ada',
        posts: new Promise(done => setTimeout(() => done(['Hello', 'World']), 10)),
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
  ];

  return Promise.all(
    examples.map(async example => ({
      id: example.id,
      label: example.label,
      description: example.description,
      input: codeFrame(await highlight(example.input, 'js'), 'Input'),
      output: codeFrame(
        await highlight(example.output, example.outputLang),
        example.outputLabel,
      ),
    })),
  );
}
