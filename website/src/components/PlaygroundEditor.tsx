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
import { placeThumbs } from '../lib/thumb';
import { CheckIcon, CircleAlertIcon, LoaderIcon, PlayIcon, ShareIcon } from './Icons';

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

// Colors come from the syntax tokens, so the editor follows the site theme.
const HIGHLIGHT = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [tags.string, tags.regexp], color: 'var(--syn-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syn-number)' },
  { tag: tags.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--syn-function)',
  },
  { tag: [tags.className, tags.typeName], color: 'var(--syn-type)' },
  { tag: tags.propertyName, color: 'var(--syn-attr)' },
  { tag: [tags.punctuation, tags.operator, tags.bracket], color: 'var(--syn-punct)' },
]);

const THEME = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: '12.8px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    fontVariantLigatures: 'none',
    lineHeight: '1.75',
  },
  '.cm-content': { caretColor: 'var(--accent-strong)', padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--text) 6%, transparent)',
  },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-tint) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--accent-strong)' },
  '.cm-tooltip': {
    border: 'none',
    borderRadius: 'var(--radius-row)',
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--accent-fill)',
    color: 'var(--on-accent)',
  },
  '.cm-panels': { backgroundColor: 'var(--surface-strong)', color: 'var(--text)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--surface-strong)',
    border: 'none',
    color: 'var(--muted)',
  },
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

const SPLIT_KEY = 'seroval:playground-split';
const SPLIT_MIN = 20;
const SPLIT_MAX = 80;
const SPLIT_STEP = 16;
const STACKED = '(max-width: 48rem)';

function clampSplit(value: number): number {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
}

function readSplit(): number {
  try {
    const value = Number(localStorage.getItem(SPLIT_KEY));
    return value > 0 ? clampSplit(value) : 50;
  } catch {
    return 50;
  }
}

export default function PlaygroundEditor(): JSX.Element {
  const initialCode = readSharedCode() ?? EXAMPLES[0].code;
  const [mode, setMode] = createSignal<Mode>('serializeAsync');
  const [output, setOutput] = createSignal('');
  const [error, setError] = createSignal<string>();
  const [stats, setStats] = createSignal<Stats>();
  const [running, setRunning] = createSignal(false);
  const [shared, setShared] = createSignal(false);
  const [split, setSplit] = createSignal(readSplit());
  const [dragging, setDragging] = createSignal(false);
  const [mac, setMac] = createSignal(false);

  let input: EditorView | undefined;
  let outputView: EditorView | undefined;
  let panes: HTMLElement | undefined;
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
      // The last good output stays, dimmed, under the error.
      if (id === runId) {
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

  function saveSplit(): void {
    try {
      localStorage.setItem(SPLIT_KEY, String(split()));
    } catch {
      // Storage can be blocked. The split then lasts for this page only.
    }
  }

  // The panes follow the pointer with no easing.
  function dragSplit(event: PointerEvent): void {
    if (!panes || matchMedia(STACKED).matches) {
      return;
    }
    const rect = panes.getBoundingClientRect();
    setSplit(clampSplit(((event.clientX - rect.left) / rect.width) * 100));
  }

  function keySplit(event: KeyboardEvent): void {
    if (!panes) {
      return;
    }
    const step = (SPLIT_STEP / panes.getBoundingClientRect().width) * 100;
    if (event.key === 'ArrowLeft') {
      setSplit((value) => clampSplit(value - step));
    } else if (event.key === 'ArrowRight') {
      setSplit((value) => clampSplit(value + step));
    } else {
      return;
    }
    event.preventDefault();
    saveSplit();
  }

  createEffect(
    () => output(),
    (text) => {
      outputView?.dispatch({
        changes: { from: 0, to: outputView.state.doc.length, insert: text },
      });
    },
  );

  // The thumb of the mode tabs follows the selected tab.
  createEffect(
    () => mode(),
    () => {
      requestAnimationFrame(() => {
        placeThumbs();
      });
    },
  );

  onSettled(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    placeThumbs();
    void execute();
    return () => {
      input?.destroy();
      outputView?.destroy();
    };
  });

  return (
    <div class="playground" data-dragging={dragging() ? '' : undefined}>
      <div class="playground-bar">
        <TabGroup<Mode>
          horizontal={true}
          value={mode()}
          onChange={(value) => {
            if (value) {
              setMode(value);
              void execute(value);
            }
          }}
        >
          <TabList class="pills" data-thumb="" aria-label="Output mode">
            <For each={MODES}>
              {(item) => (
                <Tab class="pill" value={item.id}>
                  {item.id}
                </Tab>
              )}
            </For>
          </TabList>
        </TabGroup>
        <div class="playground-bar-end">
          <label>
            <span class="visually-hidden">Load an example</span>
            <select
              class="field-input"
              onChange={(event) => {
                loadExample(event.currentTarget.value);
                event.currentTarget.value = '';
              }}
            >
              <option value="">Examples</option>
              <For each={EXAMPLES}>
                {(example) => <option value={example.id}>{example.label}</option>}
              </For>
            </select>
          </label>
          <button type="button" class="button" data-size="sm" onClick={share}>
            {shared() ? <CheckIcon /> : <ShareIcon />} {shared() ? 'Link copied' : 'Share'}
          </button>
          <button
            type="button"
            class="button"
            data-variant="primary"
            data-size="sm"
            aria-busy={running() ? 'true' : undefined}
            onClick={() => {
              void execute();
            }}
          >
            {running() ? <LoaderIcon /> : <PlayIcon />} Run
          </button>
        </div>
      </div>
      <p class="playground-hint">{MODES.find((item) => item.id === mode())?.description}</p>
      <div
        class="playground-panes"
        ref={(element) => {
          panes = element;
        }}
        style={{ '--col-a': `${split()}fr`, '--col-b': `${100 - split()}fr` }}
      >
        <section class="playground-pane" aria-label="Input">
          <header class="playground-pane-head">
            <span>Input</span>
            <span class="kbd">{mac() ? '⌘ Enter' : 'Ctrl Enter'} to run</span>
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
        <div
          class="playground-split"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the panes"
          aria-valuenow={Math.round(split())}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          tabindex="0"
          data-dragging={dragging() ? '' : undefined}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (dragging()) {
              dragSplit(event);
            }
          }}
          onPointerUp={() => {
            setDragging(false);
            saveSplit();
          }}
          onKeyDown={keySplit}
        />
        <section
          class="playground-pane"
          aria-label="Output"
          data-tone={error() ? 'danger' : undefined}
        >
          <header class="playground-pane-head">
            <span>Output</span>
            <span class="playground-status" data-tone={error() ? 'danger' : undefined}>
              <Show when={running()}>
                <LoaderIcon /> Running
              </Show>
              <Show when={!running() && error()}>
                <CircleAlertIcon /> Error
              </Show>
              <Show when={!running() && !error() && stats()}>
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
            </span>
          </header>
          <div class="playground-pane-body">
            <Show when={error()}>
              {(message) => (
                <div class="output-error" role="alert">
                  <CircleAlertIcon />
                  <span>{message()}</span>
                </div>
              )}
            </Show>
            <div
              class="pane-editor"
              data-dim={error() ? '' : undefined}
              ref={(element) => {
                outputView = createEditor(element, '', [
                  EditorState.readOnly.of(true),
                  EditorView.editable.of(false),
                  EditorView.lineWrapping,
                ]);
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
