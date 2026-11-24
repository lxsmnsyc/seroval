import type { JSX } from '@solidjs/web';
import { For, Show, onSettled } from 'solid-js';
import {
  Feature,
  crossSerialize,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  toJSON,
} from 'seroval';
import CopyButton from '../components/CopyButton';
import { ArrowRightIcon, CheckIcon, CircleXIcon, ResetIcon } from '../components/Icons';
import PageMeta from '../components/PageMeta';
import { FIRST_PAGE } from '../lib/docs';
import {
  PACKAGE_MANAGERS,
  createInstallCommands,
  syncPackageManagerButtons,
} from '../lib/package-manager';
import { placeThumb, placeThumbs } from '../lib/thumb';

const INSTALL_COMMANDS = createInstallCommands('seroval');

/* Hero: a value, its string, and the value back */

interface HeroUser {
  name: string;
  born: Date;
  notes: Map<string, string>;
  self?: HeroUser;
}

function createHeroUser(): HeroUser {
  const user: HeroUser = {
    name: 'Ada',
    born: new Date('1815-12-10'),
    notes: new Map([['G', 'Bernoulli']]),
  };
  user.self = user;
  return user;
}

/** The source the hero shows, which builds the same value as createHeroUser. */
const HERO_SOURCE = `const user = {
  name: "Ada",
  born: new Date("1815-12-10"),
  notes: new Map([["G", "Bernoulli"]]),
};
user.self = user;`;

const HERO_OUTPUT = serialize(createHeroUser());

interface HeroCheck {
  source: string;
  pass: boolean;
}

function createHeroChecks(): HeroCheck[] {
  const back = deserialize<HeroUser>(HERO_OUTPUT);
  return [
    { source: 'back.born instanceof Date', pass: back.born instanceof Date },
    { source: 'back.notes.get("G") === "Bernoulli"', pass: back.notes.get('G') === 'Bernoulli' },
    { source: 'back.self === back', pass: back.self === back },
  ];
}

const HERO_CHECKS = createHeroChecks();

/* The types seroval handles, by where they come from */

const CORE_TYPES = [
  'Date',
  'Map',
  'Set',
  'BigInt',
  'RegExp',
  'Error',
  'AggregateError',
  'Promise',
  'ArrayBuffer',
  'Uint8Array',
  'DataView',
  'AsyncIterable',
  'Temporal',
  'NaN',
  '-0',
  'Infinity',
  'undefined',
];

const PLUGIN_TYPES = [
  'URL',
  'URLSearchParams',
  'Headers',
  'FormData',
  'Blob',
  'File',
  'Request',
  'Response',
  'ReadableStream',
  'Event',
  'DOMException',
];

/* JSON.stringify next to serialize */

interface ComparisonRow {
  label: string;
  json: string;
  why: string;
  output: string;
}

function compare(label: string, value: unknown, why: string): ComparisonRow {
  let json: string;
  let reason = why;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    json = 'TypeError';
    reason = error instanceof Error ? error.message.split('\n')[0].slice(0, 46) : '';
  }
  // Leave out the error stack: it is long and differs per machine.
  return {
    label,
    json,
    why: reason,
    output: serialize(value, { disabledFeatures: Feature.ErrorPrototypeStack }),
  };
}

function createComparisonRows(): ComparisonRow[] {
  const cyclic: Record<string, unknown> = { name: 'x' };
  cyclic.self = cyclic;
  return [
    compare('new Date(0)', new Date(0), 'becomes a string'),
    compare('new Map([["a", 1]])', new Map([['a', 1]]), 'entries dropped'),
    compare('new Set([1, 2])', new Set([1, 2]), 'items dropped'),
    compare('{ x: undefined }', { x: undefined }, 'key dropped'),
    compare('[NaN, -0, Infinity]', [Number.NaN, -0, Number.POSITIVE_INFINITY], 'numbers changed'),
    compare('/ab+c/gi', /ab+c/gi, 'pattern lost'),
    compare('9007199254740993n', 9007199254740993n, ''),
    compare('new Error("boom")', new Error('boom'), 'message lost'),
    // oxlint-disable-next-line no-sparse-arrays
    compare('[, , 1]', [, , 1], 'holes filled'),
    compare('x.self = x', cyclic, ''),
  ];
}

const COMPARISON_ROWS = createComparisonRows();

/* One value in three output formats */

interface ModeValue {
  id: string;
  tags: Set<string>;
  seen: Map<string, Date>;
  self?: ModeValue;
}

function createModeValue(): ModeValue {
  const value: ModeValue = {
    id: 'ada',
    tags: new Set(['math']),
    seen: new Map([['at', new Date(0)]]),
  };
  value.self = value;
  return value;
}

interface OutputMode {
  id: string;
  letter: string;
  title: string;
  description: string;
  call: string;
  needsEval: string;
  render: () => string;
  roundTrips: () => boolean;
}

const MODES: OutputMode[] = [
  {
    id: 'js',
    letter: 'A',
    title: 'JavaScript',
    description: 'One expression. Smallest output, needs eval.',
    call: '<b>serialize</b>(value)',
    needsEval: 'Yes',
    render() {
      return serialize(createModeValue());
    },
    roundTrips() {
      const result = deserialize<ModeValue>(serialize(createModeValue()));
      return result.self === result;
    },
  },
  {
    id: 'json',
    letter: 'B',
    title: 'JSON tree',
    description: 'No eval. fromJSON validates every node.',
    call: 'JSON.stringify(<b>toJSON</b>(value))',
    needsEval: 'No',
    render() {
      return JSON.stringify(toJSON(createModeValue()));
    },
    roundTrips() {
      const result = fromJSON<ModeValue>(toJSON(createModeValue()));
      return result.self === result;
    },
  },
  {
    id: 'cross',
    letter: 'C',
    title: 'Cross-reference',
    description: 'Scripts that share refs across payloads.',
    call: '<b>crossSerialize</b>(value, { scopeId: "app" })',
    needsEval: 'Yes',
    render() {
      return crossSerialize(createModeValue(), { scopeId: 'app' });
    },
    roundTrips() {
      return true;
    },
  },
];

/* Helpers for the animations */

function escapeHTML(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function colorizeOutput(text: string): string {
  return (
    escapeHTML(text)
      // References first, before the other spans add markup: the slot
      // capture (`j=new Map`) and the deferred assignments that close
      // the cycles (`j.set("by",h)`, `h.self=h`).
      .replace(
        /\b[a-z]=(?=new )|\b[a-z]\.set\([^)]*\)|\b[a-z]\.[a-z]+=[a-z]\b/g,
        '<span class="t-ref">$&</span>',
      )
      .replace(/new Date\([^)]*\)/g, '<span class="t-date">$&</span>')
      .replace(/new Set\b/g, '<span class="t-set">$&</span>')
      .replace(/new Map\b/g, '<span class="t-map">$&</span>')
      .replace(/\b\d+n\b/g, '<span class="t-big">$&</span>')
  );
}

function colorizeSource(text: string): string {
  return escapeHTML(text)
    .replace(/"[^"]*"/g, '<span class="t-str">$&</span>')
    .replace(/\b(const|new|instanceof)\b/g, '<span class="t-kw">$&</span>')
    .replace(/\b(Date|Map)\b/g, '<span class="t-fn">$&</span>');
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function resolveLater(ms: number, value: string[]): Promise<string[]> {
  await wait(ms);
  return value;
}

function query(root: Element, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing ${selector}`);
  }
  return element;
}

/**
 * Runs every animation on the page and returns a function that stops them.
 * The hero pauses while it is off screen, and under reduced motion it shows
 * its end state once.
 */
function animate(root: HTMLElement): () => void {
  // The cleanup function sets this, and the loops below read it through
  // running(), so they stop when the page unmounts.
  let alive = true;
  function running(): boolean {
    return alive;
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The hero runs only while its stage is on screen.
  let heroVisible = true;
  let wake: (() => void) | undefined;
  async function untilVisible(): Promise<void> {
    if (running() && !heroVisible) {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      await untilVisible();
    }
  }
  async function heroWait(ms: number): Promise<void> {
    await wait(ms);
    await untilVisible();
  }

  // Hero: type the output, then pass each check of the value read back.
  // The server rendered the end state, which reduced motion keeps.
  async function runHero(): Promise<void> {
    if (reduce) {
      return;
    }
    const out = query(root, '.rt-out');
    const bytes = query(root, '.rt-bytes');
    const checks = root.querySelectorAll<HTMLElement>('.rt-check');
    while (running()) {
      for (const check of checks) {
        check.dataset.state = 'off';
      }
      out.innerHTML = '';
      bytes.textContent = '0 B';
      await heroWait(900);
      for (let i = 3; running(); i += 3) {
        const end = Math.min(i, HERO_OUTPUT.length);
        out.innerHTML = colorizeOutput(HERO_OUTPUT.slice(0, end));
        bytes.textContent = `${end} B`;
        if (end === HERO_OUTPUT.length) {
          break;
        }
        await heroWait(28);
      }
      await heroWait(500);
      for (const check of checks) {
        check.dataset.state = check.dataset.pass === 'true' ? 'on' : 'failed';
        await heroWait(450);
      }
      await heroWait(3200);
    }
  }
  runHero().catch(() => undefined);

  // Stream: send real stream chunks across the lane.
  const lane = query(root, '.lane');
  const log = query(root, '.log');
  let streamRun = 0;

  async function shoot(text: string, later: boolean): Promise<void> {
    const packet = document.createElement('div');
    packet.className = later ? 'packet later' : 'packet';
    packet.textContent = text;
    lane.appendChild(packet);
    const distance = lane.clientWidth - 240 - packet.offsetWidth;
    const animation = packet.animate(
      [
        { transform: 'translate(0,-50%) scale(.6)', opacity: 0 },
        { transform: 'translate(0,-50%)', opacity: 1, offset: 0.1 },
        { transform: `translate(${distance}px,-50%)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${distance + 40}px,-50%) scale(.4)`, opacity: 0 },
      ],
      { duration: reduce ? 1 : 1100, easing: 'cubic-bezier(.5,0,.2,1)' },
    );
    await animation.finished;
    packet.remove();
  }

  function fillView(key: string, text: string): void {
    const view = query(root, `.cv-${key}`);
    view.className = `v cv-${key}`;
    view.textContent = text;
  }

  function runStream(): void {
    const id = ++streamRun;
    log.innerHTML = '';
    for (const key of ['user', 'posts', 'rec']) {
      const view = query(root, `.cv-${key}`);
      view.className = `v pending cv-${key}`;
      view.textContent = '';
    }
    const data = {
      user: 'Ada Lovelace',
      posts: resolveLater(1200, ['Note G', 'Sketch']),
      recommended: resolveLater(2400, ['Babbage']),
    };
    const started = performance.now();
    let count = 0;
    crossSerializeStream(data, {
      scopeId: 'demo',
      onSerialize(chunk, initial) {
        if (id !== streamRun || !running()) {
          return;
        }
        const ms = Math.round(performance.now() - started);
        const index = count++;
        const row = document.createElement('div');
        row.className = 'log-row';
        row.innerHTML = `<span class="ms">+${ms}ms</span><span>${initial ? 'initial' : 'resolve'}</span><span class="code">${escapeHTML(chunk.replace(/\s+/g, ' '))}</span><span class="sz">${chunk.length} B</span>`;
        const label = initial ? 'chunk 0 · shell' : `chunk ${index} · promise`;
        shoot(label, !initial)
          .then(() => {
            if (id !== streamRun || !running()) {
              return;
            }
            log.prepend(row);
            if (initial) {
              fillView('user', data.user);
            } else if (index === 1) {
              fillView('posts', 'Note G, Sketch');
            } else {
              fillView('rec', 'Babbage');
            }
          })
          .catch(() => undefined);
      },
    });
  }
  const replay = query(root, '.replay');
  replay.addEventListener('click', runStream);

  // Output formats: show a format's output one character at a time.
  const tablist = query(root, '.mode-tabs');
  const modeButtons = tablist.querySelectorAll<HTMLButtonElement>('[data-mode]');
  function showMode(id: string): void {
    for (const button of modeButtons) {
      const selected = button.dataset.mode === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    placeThumb(tablist);
    for (const mode of MODES) {
      if (mode.id !== id) {
        continue;
      }
      const output = mode.render();
      query(root, '.mode-note').textContent = mode.description;
      query(root, '.mode-fn').innerHTML = mode.call;
      let html = '';
      let i = 0;
      for (const char of output) {
        // Under reduced motion the output appears at once.
        const delay = reduce ? 0 : Math.min(i * 3, 900);
        html += `<span class="ch" style="animation-delay:${delay}ms">${escapeHTML(char)}</span>`;
        i++;
      }
      query(root, '.mode-pre').innerHTML = html;
      query(root, '.mode-size').textContent = `${output.length} B`;
      query(root, '.mode-eval').textContent = mode.needsEval;
      query(root, '.mode-rt').textContent = mode.roundTrips() ? 'Yes' : '—';
    }
  }
  function onModeClick(event: Event): void {
    const button = event.currentTarget;
    if (button instanceof HTMLElement && button.dataset.mode) {
      showMode(button.dataset.mode);
    }
  }
  // Arrow keys, Home and End move between the tabs, as in any tab list.
  function onModeKeyDown(event: KeyboardEvent): void {
    const tabs = [...modeButtons];
    let at = -1;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i] === document.activeElement) {
        at = i;
      }
    }
    if (at < 0) {
      return;
    }
    let next: HTMLButtonElement | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = tabs[(at + 1) % tabs.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = tabs[(at - 1 + tabs.length) % tabs.length];
    } else if (event.key === 'Home') {
      next = tabs[0];
    } else if (event.key === 'End') {
      next = tabs[tabs.length - 1];
    }
    if (next) {
      event.preventDefault();
      next.click();
      next.focus();
    }
  }
  for (const button of modeButtons) {
    button.addEventListener('click', onModeClick);
  }
  tablist.addEventListener('keydown', onModeKeyDown);

  // The install pickers match the stored package manager.
  syncPackageManagerButtons();
  placeThumbs();

  // Start each demo once, when it first scrolls in. The comparison rows
  // strike through the lost values one after another.
  let streamed = false;
  let moded = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        const element = entry.target;
        if (!(element instanceof HTMLElement)) {
          continue;
        }
        if (element.classList.contains('cmp-row')) {
          const order = Number(element.dataset.order ?? 0);
          setTimeout(
            () => {
              element.classList.add('in-view');
            },
            reduce ? 0 : 200 + (order % 5) * 90,
          );
        }
        if (element.classList.contains('stream') && !streamed) {
          streamed = true;
          runStream();
        }
        if (element.classList.contains('modes') && !moded) {
          moded = true;
          showMode('js');
        }
        observer.unobserve(element);
      }
    },
    { threshold: 0.2 },
  );
  for (const element of root.querySelectorAll('[data-reveal]')) {
    observer.observe(element);
  }

  // Pause the hero while its stage is off screen.
  const stageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      heroVisible = entry.isIntersecting;
      if (heroVisible) {
        wake?.();
      }
    }
  });
  stageObserver.observe(query(root, '.stage'));

  return () => {
    alive = false;
    streamRun++;
    wake?.();
    observer.disconnect();
    stageObserver.disconnect();
    replay.removeEventListener('click', runStream);
    for (const button of modeButtons) {
      button.removeEventListener('click', onModeClick);
    }
    tablist.removeEventListener('keydown', onModeKeyDown);
  };
}

/** The package manager picker, one command and a copy button. */
function InstallCommand(): JSX.Element {
  return (
    <div class="install">
      <span class="pills" data-thumb="" role="group" aria-label="Package manager">
        <For each={PACKAGE_MANAGERS}>
          {(manager) => (
            <button
              type="button"
              class="pill"
              data-pm-option={manager}
              aria-pressed={manager === 'npm' ? 'true' : 'false'}
            >
              {manager}
            </button>
          )}
        </For>
      </span>
      <For each={PACKAGE_MANAGERS}>
        {(manager) => (
          <div class="install-line" data-pm-command={manager}>
            <code>{INSTALL_COMMANDS[manager]}</code>
            <CopyButton text={INSTALL_COMMANDS[manager]} />
          </div>
        )}
      </For>
    </div>
  );
}

function SectionHead(props: { id: string; title: string; lead?: string }): JSX.Element {
  return (
    <header class="section-head">
      <h2 class="row-title" id={props.id}>
        {props.title}
      </h2>
      <Show when={props.lead}>
        <p class="row-lead">{props.lead}</p>
      </Show>
    </header>
  );
}

export default function Home(): JSX.Element {
  let root: HTMLDivElement | undefined;

  onSettled(() => {
    if (root) {
      return animate(root);
    }
    return undefined;
  });

  return (
    <div
      class="home"
      ref={(element) => {
        root = element;
      }}
    >
      <PageMeta description="Serialize the JavaScript values JSON cannot: cyclic references, Dates, Maps, promises, streams and more." />

      <section class="tile hero" data-tone="ink">
        <div class="hero-copy">
          <h1 class="hero-title">
            Serialize what JSON <em>can't.</em>
          </h1>
          <p class="hero-tagline">
            seroval turns JavaScript values into a string and back, including cyclic references,
            Date, Map, Set, BigInt and Promise, as code or as JSON.
          </p>
          <div class="hero-actions">
            <a class="button" data-variant="primary" href={FIRST_PAGE.href}>
              Read the docs <ArrowRightIcon class="icon-arrow" />
            </a>
            <a class="button" data-variant="quiet" href="/playground">
              Open playground
            </a>
          </div>
          <InstallCommand />
        </div>
        <div class="stage">
          <div class="rt-pane">
            <div class="rt-label">value</div>
            {/* oxlint-disable-next-line solid/no-innerhtml -- fixed source, escaped by colorizeSource. */}
            <pre class="rt-code" innerHTML={colorizeSource(HERO_SOURCE)} />
          </div>
          <div class="rt-step">serialize(user)</div>
          <div class="rt-pane">
            <div class="rt-label">
              <span>string</span>
              <span class="rt-bytes">{HERO_OUTPUT.length} B</span>
            </div>
            <pre class="rt-code">
              {/* oxlint-disable-next-line solid/no-innerhtml -- seroval output, escaped by colorizeOutput. */}
              <span class="rt-out" innerHTML={colorizeOutput(HERO_OUTPUT)} />
              <span class="caret" />
            </pre>
          </div>
          <div class="rt-step">deserialize(string)</div>
          <ul class="rt-pane rt-checks">
            <For each={HERO_CHECKS}>
              {(check) => (
                <li
                  class="rt-check"
                  data-pass={check.pass ? 'true' : 'false'}
                  data-state={check.pass ? 'on' : 'failed'}
                >
                  <span class="rt-dot">
                    <CheckIcon />
                  </span>
                  {/* oxlint-disable-next-line solid/no-innerhtml -- fixed source, escaped by colorizeSource. */}
                  <code innerHTML={colorizeSource(check.source)} />
                </li>
              )}
            </For>
          </ul>
        </div>
      </section>

      <section aria-labelledby="lossless">
        <SectionHead
          id="lossless"
          title="JSON.stringify drops data. serialize keeps it."
          lead="Each row runs in your browser: JSON.stringify in the middle column, serialize in the right one."
        />
        <div class="tile">
          <div class="cmp">
            <div class="cmp-row cmp-head">
              <span>Value</span>
              <span>JSON.stringify</span>
              <span>serialize</span>
            </div>
            <For each={COMPARISON_ROWS}>
              {(row, index) => (
                <div class="cmp-row" data-reveal="" data-order={index()}>
                  <span class="in">{row.label}</span>
                  <span class="json" data-label="JSON.stringify">
                    <span class="v">{row.json}</span>
                    <Show when={row.why}>
                      <span class="why chip" data-tone="danger">
                        <CircleXIcon />
                        {row.why}
                      </span>
                    </Show>
                  </span>
                  <span class="sv" data-label="serialize">
                    {row.output}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      <section aria-labelledby="streaming">
        <SectionHead
          id="streaming"
          title="Stream values as they resolve."
          lead="The synchronous part ships first and each promise follows when it settles, shown with real crossSerializeStream chunks."
        />
        <div class="tile">
          <div class="stream" data-reveal="">
            <div class="lane">
              <div class="end srv">
                <b>S</b>server
              </div>
              <div class="rail" />
              <div class="end cli">
                <b>C</b>browser
              </div>
            </div>
            <div class="client-view">
              <div class="cv">
                <div class="k">user</div>
                <div class="v pending cv-user" />
              </div>
              <div class="cv">
                <div class="k">posts · 1.2 s</div>
                <div class="v pending cv-posts" />
              </div>
              <div class="cv">
                <div class="k">recommended · 2.4 s</div>
                <div class="v pending cv-rec" />
              </div>
            </div>
            <div class="log" />
            <div class="stream-actions">
              <button type="button" class="button replay" data-size="sm">
                <ResetIcon /> Replay
              </button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="formats">
        <SectionHead
          id="formats"
          title="Three output formats, same references."
          lead="Pick the format that fits the wire. Each one keeps shared and cyclic references."
        />
        <div class="tile">
          <div class="modes" data-reveal="">
            <div class="pills mode-tabs" data-thumb="" role="tablist" aria-label="Output format">
              <For each={MODES}>
                {(mode, index) => (
                  <button
                    type="button"
                    class="pill"
                    role="tab"
                    aria-selected={index() === 0 ? 'true' : 'false'}
                    tabindex={index() === 0 ? 0 : -1}
                    data-mode={mode.id}
                  >
                    {mode.title}
                  </button>
                )}
              </For>
            </div>
            <p class="mode-note">{MODES[0].description}</p>
            <div class="mode-out" role="tabpanel">
              <div class="mode-fn" />
              <pre class="mode-pre" />
            </div>
            <dl class="facts">
              <div class="fact">
                <dt>Size</dt>
                <dd class="mode-size" />
              </div>
              <div class="fact">
                <dt>Needs eval</dt>
                <dd class="mode-eval" />
              </div>
              <div class="fact">
                <dt>Round trip</dt>
                <dd class="mode-rt" />
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section aria-labelledby="types">
        <SectionHead
          id="types"
          title="More types, built in or by plugin."
          lead="Core handles the JavaScript built-ins, and seroval-plugins adds the Web API types."
        />
        <div class="grid">
          <div class="tile span-6 type-card">
            <h3 class="card-title">Built in</h3>
            <div class="chips">
              <For each={CORE_TYPES}>
                {(name) => (
                  <span class="chip" data-mono="">
                    {name}
                  </span>
                )}
              </For>
            </div>
          </div>
          <div class="tile span-6 type-card">
            <h3 class="card-title">With seroval-plugins</h3>
            <div class="chips">
              <For each={PLUGIN_TYPES}>
                {(name) => (
                  <span class="chip" data-mono="">
                    {name}
                  </span>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="used-by">
        <SectionHead id="used-by" title="Used by" />
        <div class="tile">
          <ul class="used-by">
            <li>SolidJS</li>
            <li>TanStack Start</li>
          </ul>
        </div>
      </section>

      <section class="tile cta" data-tone="ink">
        <div class="cta-copy">
          <h2 class="cta-title">Send more than JSON.</h2>
          <div class="hero-actions">
            <a class="button" data-variant="primary" href={FIRST_PAGE.href}>
              Read the docs <ArrowRightIcon class="icon-arrow" />
            </a>
            <a class="button" data-variant="quiet" href="/playground">
              Open playground
            </a>
          </div>
        </div>
        <InstallCommand />
      </section>
    </div>
  );
}
