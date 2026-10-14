import * as seroval from 'seroval';
import * as webPlugins from 'seroval-plugins/web';
import { createSignal, For, onSettled, Show } from 'solid-js';

const PLUGINS = Object.values(webPlugins);

type Mode =
  | 'serialize'
  | 'serializeAsync'
  | 'toJSONAsync'
  | 'crossSerializeAsync'
  | 'crossSerializeStream';

const MODES: { id: Mode; label: string; description: string }[] = [
  {
    id: 'serialize',
    label: 'serialize',
    description: 'A JavaScript expression. Sync values only.',
  },
  {
    id: 'serializeAsync',
    label: 'serializeAsync',
    description: 'A JavaScript expression, after every promise settles.',
  },
  {
    id: 'toJSONAsync',
    label: 'toJSONAsync',
    description: 'A JSON tree, decoded with fromJSON.',
  },
  {
    id: 'crossSerializeAsync',
    label: 'crossSerializeAsync',
    description: 'An expression that uses a shared reference store.',
  },
  {
    id: 'crossSerializeStream',
    label: 'crossSerializeStream',
    description: 'One chunk per settled value, as a stream would send them.',
  },
];

const DEFAULT_CODE = `// Return the value to serialize.
// \`seroval\` holds the library exports.
const user = {
  name: 'Ada',
  joined: new Date(0),
  roles: new Set(['admin']),
  settings: new Map([['theme', 'dark']]),
  score: 10n ** 20n,
  avatar: Promise.resolve(new URL('https://example.com/ada.png')),
};
user.self = user;
return user;`;

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
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
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

// Runs the user's code. The code runs in the reader's own browser, the same
// as code typed into the developer console.
function evaluate(code: string): unknown {
  return new Function('seroval', code)(seroval);
}

function collectStream(value: unknown): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    seroval.crossSerializeStream(value, {
      plugins: PLUGINS,
      scopeId: 'playground',
      onSerialize(chunk) {
        chunks.push(chunk);
      },
      onDone() {
        resolve(chunks);
      },
      onError: reject,
    });
  });
}

// Seroval wraps the error that stopped it, so the cause is shown as well.
function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const message = `${error.name}: ${error.message}`;
  return error.cause ? `${message}\n\nCaused by ${formatError(error.cause)}` : message;
}

async function run(mode: Mode, code: string): Promise<string[]> {
  const value = evaluate(code);
  switch (mode) {
    case 'serialize':
      return [seroval.serialize(value, { plugins: PLUGINS })];
    case 'serializeAsync':
      return [await seroval.serializeAsync(value, { plugins: PLUGINS })];
    case 'toJSONAsync':
      return [
        JSON.stringify(
          await seroval.toJSONAsync(value, { plugins: PLUGINS }),
          null,
          2,
        ),
      ];
    case 'crossSerializeAsync':
      return [
        await seroval.crossSerializeAsync(value, {
          plugins: PLUGINS,
          scopeId: 'playground',
        }),
      ];
    case 'crossSerializeStream':
      return collectStream(value);
  }
}

export default function PlaygroundEditor() {
  const [code, setCode] = createSignal(readSharedCode() ?? DEFAULT_CODE);
  const [mode, setMode] = createSignal<Mode>('serializeAsync');
  const [output, setOutput] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string>();
  const [copied, setCopied] = createSignal(false);

  let runId = 0;

  async function execute(nextMode: Mode, nextCode: string) {
    const id = ++runId;
    try {
      const result = await run(nextMode, nextCode);
      if (id === runId) {
        setOutput(result);
        setError(undefined);
      }
    } catch (err) {
      if (id === runId) {
        setOutput([]);
        setError(formatError(err));
      }
    }
  }

  function share() {
    const url = `${location.origin}${location.pathname}${HASH_PREFIX}${encodeCode(code())}`;
    history.replaceState(null, '', url);
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // The URL is still in the address bar when the clipboard is blocked.
      },
    );
  }

  onSettled(() => {
    execute(mode(), code());
  });

  return (
    <div class="playground">
      <div class="playground-toolbar">
        <label class="mode-select">
          <span>Mode</span>
          <select
            value={mode()}
            onChange={event => {
              const next = event.currentTarget.value as Mode;
              setMode(next);
              execute(next, code());
            }}
          >
            <For each={MODES}>
              {item => <option value={item.id}>{item.label}</option>}
            </For>
          </select>
        </label>
        <button
          type="button"
          class="button primary"
          onClick={() => execute(mode(), code())}
        >
          Run
        </button>
        <button type="button" class="button" onClick={share}>
          {copied() ? 'Link copied' : 'Share'}
        </button>
      </div>
      <p class="mode-description">
        {MODES.find(item => item.id === mode())?.description}
      </p>
      <div class="playground-panes">
        <textarea
          class="code-input"
          spellcheck={false}
          aria-label="Code"
          value={code()}
          onInput={event => setCode(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              execute(mode(), event.currentTarget.value);
            }
          }}
        />
        <div class="code-output" aria-live="polite">
          <Show when={error()}>
            {message => <pre class="output-error">{message()}</pre>}
          </Show>
          <For each={output()}>
            {(chunk, index) => (
              <div class="output-chunk">
                <Show when={output().length > 1}>
                  <span class="chunk-label">Chunk {index() + 1}</span>
                </Show>
                <pre>
                  <code>{chunk}</code>
                </pre>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
