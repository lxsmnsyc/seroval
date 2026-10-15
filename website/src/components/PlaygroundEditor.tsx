import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState, type Extension, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { JSX } from '@solidjs/web';
import { basicSetup } from 'codemirror';
import * as seroval from 'seroval';
import * as webPlugins from 'seroval-plugins/web';
import { For, Show, createEffect, createSignal, onSettled } from 'solid-js';
import { Tab, TabGroup, TabList } from 'terracotta/tabs';
import { PlayIcon, ShareIcon } from './Icons';

const PLUGINS = Object.values(webPlugins);

type Mode =
  | 'serialize'
  | 'serializeAsync'
  | 'toJSONAsync'
  | 'crossSerializeAsync'
  | 'crossSerializeStream';

const MODES: { id: Mode; description: string }[] = [
  {
    id: 'serialize',
    description: 'A JavaScript expression that rebuilds the value. Synchronous values only.',
  },
  {
    id: 'serializeAsync',
    description: 'A JavaScript expression, produced after every promise settles.',
  },
  {
    id: 'toJSONAsync',
    description: 'A JSON tree, decoded with fromJSON and never evaluated.',
  },
  {
    id: 'crossSerializeAsync',
    description:
      'A script that stores values in a shared $R array, so later scripts can refer back to them.',
  },
  {
    id: 'crossSerializeStream',
    description: 'One script per settled value, in the order a server would stream them.',
  },
];

const EXAMPLES: { id: string; label: string; code: string }[] = [
  {
    id: 'basics',
    label: 'Built-in types',
    code: `// Return the value to serialize.
// \`seroval\` holds every export of the library.
const user = {
  name: 'Ada',
  joined: new Date('2026-01-01'),
  roles: new Set(['admin', 'editor']),
  prefs: new Map([['theme', 'dark']]),
  score: 10n ** 20n,
  pattern: /^[a-z]+$/i,
  missing: undefined,
  weird: [NaN, -0, Infinity],
};
return user;`,
  },
  {
    id: 'cyclic',
    label: 'Cyclic references',
    code: `const parent = { name: 'root', children: [] };
const child = { name: 'leaf', parent };
parent.children.push(child);
parent.self = parent;

return parent;`,
  },
  {
    id: 'async',
    label: 'Promises',
    code: `// Try serializeAsync or crossSerializeStream.
const wait = (ms, value) =>
  new Promise(resolve => setTimeout(() => resolve(value), ms));

return {
  user: 'Ada',
  posts: wait(200, ['Hello', 'World']),
  comments: wait(400, [{ text: 'Nice!' }]),
};`,
  },
  {
    id: 'stream',
    label: 'Streams',
    code: `// Try crossSerializeStream to see one chunk per event.
const stream = seroval.createStream();

let count = 0;
const timer = setInterval(() => {
  count += 1;
  if (count < 4) {
    stream.next({ tick: count });
  } else {
    clearInterval(timer);
    stream.return('done');
  }
}, 150);

return { stream };`,
  },
  {
    id: 'web',
    label: 'Web types',
    code: `// seroval-plugins/web is enabled in the playground.
const form = new FormData();
form.append('name', 'Ada');

return {
  url: new URL('https://example.com/search?q=seroval'),
  headers: new Headers({ 'content-type': 'application/json' }),
  form,
  request: new Request('https://example.com/api', {
    method: 'POST',
    body: 'hi',
  }),
};`,
  },
  {
    id: 'errors',
    label: 'Errors',
    code: `const cause = new TypeError('Bad input');
const error = new Error('Request failed', { cause });
error.code = 'E_REQUEST';

return {
  error,
  many: new AggregateError([cause, new RangeError('Too big')], 'Several'),
};`,
  },
];

const HASH_PREFIX = '#code=';

function encodeCode(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_');
}

function decodeCode(value: string): string | undefined {
  try {
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

function readSharedCode(): string | undefined {
  if (location.hash.startsWith(HASH_PREFIX)) {
    return decodeCode(location.hash.slice(HASH_PREFIX.length));
  }
  return undefined;
}

// Runs the reader's code in their own browser, the same as code typed into
// the developer console.
function evaluate(code: string): unknown {
  // oxlint-disable-next-line no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call -- Running the code is the point of the playground.
  return new Function('seroval', code)(seroval);
}

// Calls onChunk with every chunk so far, so the output shows each chunk as
// it arrives instead of waiting for the stream to end.
async function collectStream(
  value: unknown,
  onChunk: (chunks: string[]) => void,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    seroval.crossSerializeStream(value, {
      plugins: PLUGINS,
      scopeId: 'playground',
      onSerialize(chunk) {
        chunks.push(chunk);
        onChunk(chunks);
      },
      onDone() {
        resolve(chunks);
      },
      onError: reject,
    });
  });
}

async function run(
  mode: Mode,
  code: string,
  onChunk: (chunks: string[]) => void,
): Promise<string[]> {
  const value = evaluate(code);
  switch (mode) {
    case 'serialize':
      return [seroval.serialize(value, { plugins: PLUGINS })];
    case 'serializeAsync':
      return [await seroval.serializeAsync(value, { plugins: PLUGINS })];
    case 'toJSONAsync':
      return [JSON.stringify(await seroval.toJSONAsync(value, { plugins: PLUGINS }), null, 2)];
    case 'crossSerializeAsync':
      return [
        await seroval.crossSerializeAsync(value, {
          plugins: PLUGINS,
          scopeId: 'playground',
        }),
      ];
    case 'crossSerializeStream':
    default:
      return collectStream(value, onChunk);
  }
}

// Seroval wraps the error that stopped it, so the cause is shown as well.
function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const message = `${error.name}: ${error.message}`;
  return error.cause ? `${message}\n\nCaused by ${formatError(error.cause)}` : message;
}

function formatOutput(chunks: string[]): string {
  if (chunks.length === 1) {
    return chunks[0];
  }
  return chunks.map((chunk, i) => `// Chunk ${i + 1}\n${chunk}`).join('\n\n');
}

// Colors come from CSS variables, so the editor follows the site theme.
const HIGHLIGHT = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], color: 'var(--syntax-keyword)' },
  { tag: [tags.string, tags.regexp], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syntax-number)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--syntax-function)',
  },
  { tag: [tags.className, tags.typeName], color: 'var(--syntax-type)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
]);

const THEME = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--fg)',
    fontSize: '13.5px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    fontVariantLigatures: 'none',
    lineHeight: '1.65',
  },
  '.cm-content': { caretColor: 'var(--accent)', padding: '14px 0' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--fg-subtle)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
});

function createEditor(parent: HTMLElement, doc: string, extensions: Extension[]): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [basicSetup, javascript(), THEME, syntaxHighlighting(HIGHLIGHT), ...extensions],
    }),
  });
}

interface Stats {
  bytes: number;
  ms: number;
  chunks: number;
}

export default function PlaygroundEditor(): JSX.Element {
  const initialCode = readSharedCode() ?? EXAMPLES[0].code;
  const [mode, setMode] = createSignal<Mode>('serializeAsync');
  const [output, setOutput] = createSignal('');
  const [error, setError] = createSignal<string>();
  const [stats, setStats] = createSignal<Stats>();
  const [running, setRunning] = createSignal(false);
  const [shared, setShared] = createSignal(false);

  let input: EditorView | undefined;
  let outputView: EditorView | undefined;
  let runId = 0;

  async function execute(nextMode = mode()): Promise<void> {
    if (!input) {
      return;
    }
    const id = ++runId;
    const code = input.state.doc.toString();
    const started = performance.now();
    setRunning(true);
    function show(chunks: string[]): void {
      if (id === runId) {
        setOutput(formatOutput(chunks));
        setError(undefined);
        setStats({
          bytes: new TextEncoder().encode(chunks.join('')).length,
          ms: performance.now() - started,
          chunks: chunks.length,
        });
      }
    }
    try {
      show(await run(nextMode, code, show));
    } catch (err) {
      if (id === runId) {
        setOutput('');
        setError(formatError(err));
        setStats(undefined);
      }
    } finally {
      if (id === runId) {
        setRunning(false);
      }
    }
  }

  function loadExample(id: string): void {
    const example = EXAMPLES.find((item) => item.id === id);
    if (example && input) {
      input.dispatch({
        changes: { from: 0, to: input.state.doc.length, insert: example.code },
      });
      void execute();
    }
  }

  function share(): void {
    if (!input) {
      return;
    }
    const url = `${location.origin}${location.pathname}${HASH_PREFIX}${encodeCode(input.state.doc.toString())}`;
    history.replaceState(null, '', url);
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- The clipboard is missing outside secure contexts.
    navigator.clipboard?.writeText(url).then(
      () => {
        setShared(true);
        setTimeout(() => {
          setShared(false);
        }, 1500);
      },
      () => {
        // The link is still in the address bar when the clipboard is blocked.
      },
    );
  }

  createEffect(
    () => output(),
    (text) => {
      outputView?.dispatch({
        changes: { from: 0, to: outputView.state.doc.length, insert: text },
      });
    },
  );

  onSettled(() => {
    void execute();
    return () => {
      input?.destroy();
      outputView?.destroy();
    };
  });

  return (
    <div class="playground">
      <div class="playground-toolbar">
        <TabGroup<Mode>
          class="mode-tabs"
          horizontal={true}
          value={mode()}
          onChange={(value) => {
            if (value) {
              setMode(value);
              void execute(value);
            }
          }}
        >
          <TabList class="segmented" aria-label="Output mode">
            <For each={MODES}>
              {(item) => (
                <Tab class="segmented-item" value={item.id}>
                  {item.id}
                </Tab>
              )}
            </For>
          </TabList>
        </TabGroup>
        <div class="toolbar-actions">
          <label class="example-select">
            <span class="visually-hidden">Load an example</span>
            <select
              onChange={(event) => {
                loadExample(event.currentTarget.value);
                event.currentTarget.value = '';
              }}
            >
              <option value="">Examples…</option>
              <For each={EXAMPLES}>
                {(example) => <option value={example.id}>{example.label}</option>}
              </For>
            </select>
          </label>
          <button type="button" class="button button-secondary button-small" onClick={share}>
            <ShareIcon /> {shared() ? 'Link copied' : 'Share'}
          </button>
          <button
            type="button"
            class="button button-primary button-small"
            onClick={() => {
              void execute();
            }}
          >
            <PlayIcon /> Run
          </button>
        </div>
      </div>
      <p class="mode-description">{MODES.find((item) => item.id === mode())?.description}</p>
      <div class="playground-panes">
        <section class="pane" aria-label="Input">
          <header class="pane-header">
            <span>Input</span>
            <kbd>⌘ Enter to run</kbd>
          </header>
          <div
            class="pane-editor"
            ref={(element) => {
              // The default keymap binds Mod-Enter too, so this one must win.
              input = createEditor(element, initialCode, [
                Prec.highest(
                  keymap.of([
                    {
                      key: 'Mod-Enter',
                      run: () => {
                        void execute();
                        return true;
                      },
                    },
                  ]),
                ),
              ]);
            }}
          />
        </section>
        <section class="pane" aria-label="Output">
          <header class="pane-header">
            <span>Output</span>
            <Show when={running()}>
              <span class="pane-status">Running…</span>
            </Show>
          </header>
          <Show when={error()}>{(message) => <pre class="output-error">{message()}</pre>}</Show>
          <div
            class={['pane-editor', { hidden: !!error() }]}
            ref={(element) => {
              outputView = createEditor(element, '', [
                EditorState.readOnly.of(true),
                EditorView.editable.of(false),
                EditorView.lineWrapping,
              ]);
            }}
          />
          <footer class="pane-footer">
            <Show when={stats()} fallback={<span>Ready</span>}>
              {(current) => (
                <>
                  <span>{current().bytes.toLocaleString()} bytes</span>
                  <Show when={current().chunks > 1}>
                    <span>{current().chunks} chunks</span>
                  </Show>
                  <span>{current().ms.toFixed(1)} ms</span>
                </>
              )}
            </Show>
          </footer>
        </section>
      </div>
    </div>
  );
}
