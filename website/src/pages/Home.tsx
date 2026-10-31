import type { JSX } from '@solidjs/web';
import { For, onSettled } from 'solid-js';
import {
  Feature,
  crossSerialize,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  toJSON,
} from 'seroval';
import PageMeta from '../components/PageMeta';
import { FIRST_PAGE } from '../lib/docs';
import { SHORT_VERSION } from '../lib/ui';

const INSTALL_COMMAND = 'npm install seroval';
const SVG_NS = 'http://www.w3.org/2000/svg';

/* Hero: an object graph that serializes itself */

interface HeroUser {
  name: string;
  born: Date;
  tags: Set<string>;
  notes: Map<string, unknown>;
  id: bigint;
  self?: HeroUser;
}

function createHeroUser(): HeroUser {
  const user: HeroUser = {
    name: 'Ada',
    born: new Date('1815-12-10'),
    tags: new Set(['math', 'engines']),
    notes: new Map<string, unknown>([['G', 'Bernoulli']]),
    id: 1815n,
  };
  user.self = user;
  user.notes.set('by', user);
  return user;
}

const HERO_OUTPUT = serialize(createHeroUser());

interface GraphNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  color: string;
  // The part of the output that lights the node up once it is typed.
  token: string;
}

const NODES: GraphNode[] = [
  {
    id: 'obj',
    label: 'Object',
    sub: 'user',
    x: 300,
    y: 210,
    color: 'var(--c-obj)',
    token: '{name',
  },
  {
    id: 'date',
    label: 'Date',
    sub: '1815-12-10',
    x: 120,
    y: 110,
    color: 'var(--c-date)',
    token: 'new Date',
  },
  {
    id: 'set',
    label: 'Set',
    sub: '2 items',
    x: 480,
    y: 100,
    color: 'var(--c-set)',
    token: 'new Set',
  },
  {
    id: 'map',
    label: 'Map',
    sub: '2 entries',
    x: 470,
    y: 330,
    color: 'var(--c-map)',
    token: 'new Map',
  },
  {
    id: 'big',
    label: 'BigInt',
    sub: '1815n',
    x: 130,
    y: 330,
    color: 'var(--c-big)',
    token: '1815n',
  },
];

interface GraphEdge {
  from: string;
  to: string;
  cyclic: boolean;
}

const EDGES: GraphEdge[] = [
  { from: 'obj', to: 'date', cyclic: false },
  { from: 'obj', to: 'set', cyclic: false },
  { from: 'obj', to: 'map', cyclic: false },
  { from: 'obj', to: 'big', cyclic: false },
  { from: 'map', to: 'obj', cyclic: true },
  { from: 'obj', to: 'obj', cyclic: true },
];

/* Marquee */

const TYPES = [
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
  'NaN',
  '−0',
  'Infinity',
  'undefined',
  'Temporal',
  'URL',
  'Headers',
  'FormData',
  'Blob',
  'File',
  'Request',
  'Response',
  'ReadableStream',
];

const SNIPPETS = [
  'x.self = x',
  'new Map([[k, v]])',
  'Object.create(null)',
  '[ , , 1]',
  'Symbol.asyncIterator',
  'await fetch()',
  'new Uint8Array(8)',
  '/ab+c/gi',
  '9007199254740993n',
];

/* 01: JSON.stringify next to serialize */

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

/* 03: one value in three output formats */

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

function createSVG(
  tag: string,
  attributes: Record<string, string | number>,
  parent: Element,
): SVGElement {
  const element = document.createElementNS(SVG_NS, tag);
  for (const name of Object.keys(attributes)) {
    element.setAttribute(name, String(attributes[name]));
  }
  parent.appendChild(element);
  return element;
}

interface LiveNode {
  node: GraphNode;
  group: SVGElement;
  halo: SVGElement;
  at: number;
  cx: number;
  cy: number;
}

/**
 * Runs every animation on the page and returns a function that stops them.
 */
function animate(root: HTMLElement): () => void {
  // The cleanup function sets this, and the loops below read it through
  // running(), so they stop when the page unmounts.
  let alive = true;
  function running(): boolean {
    return alive;
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero graph: build the nodes and edges.
  const svg = root.querySelector('.graph');
  if (!svg) {
    throw new Error('Missing .graph');
  }
  const edgeElements: SVGElement[] = [];
  for (const edge of EDGES) {
    edgeElements.push(createSVG('path', { class: edge.cyclic ? 'edge cyc' : 'edge' }, svg));
  }
  const live = new Map<string, LiveNode>();
  for (const node of NODES) {
    const group = createSVG('g', { class: 'node' }, svg);
    const halo = createSVG('circle', { class: 'halo', r: 0, fill: node.color, opacity: 0 }, group);
    createSVG(
      'circle',
      { r: 30, fill: 'var(--bg)', stroke: node.color, 'stroke-width': 1.2 },
      group,
    );
    createSVG('text', { class: 'type', 'text-anchor': 'middle', dy: 5 }, group).textContent =
      node.label;
    createSVG('text', { 'text-anchor': 'middle', dy: 52 }, group).textContent = node.sub;
    live.set(node.id, {
      node,
      group,
      halo,
      at: HERO_OUTPUT.indexOf(node.token),
      cx: node.x,
      cy: node.y,
    });
  }
  const orb = createSVG('circle', { r: 4, fill: 'var(--signal)', opacity: 0 }, svg);

  // Hero graph: drift the nodes and redraw the edges every frame.
  const start = performance.now();
  let frameId = 0;
  function drawFrame(now: number): void {
    const t = (now - start) / 1000;
    let index = 0;
    for (const item of live.values()) {
      item.cx = item.node.x + Math.sin(t * 0.6 + index * 1.7) * 8;
      item.cy = item.node.y + Math.cos(t * 0.5 + index * 1.3) * 8;
      item.group.setAttribute('transform', `translate(${item.cx} ${item.cy})`);
      index++;
    }
    for (let i = 0; i < EDGES.length; i++) {
      const edge = EDGES[i];
      const a = live.get(edge.from)!;
      const b = live.get(edge.to)!;
      let d: string;
      if (a === b) {
        d = `M${a.cx - 20} ${a.cy - 22} C ${a.cx - 70} ${a.cy - 120}, ${a.cx + 70} ${a.cy - 120}, ${a.cx + 20} ${a.cy - 22}`;
      } else if (edge.cyclic) {
        const mx = (a.cx + b.cx) / 2 + 60;
        const my = (a.cy + b.cy) / 2 + 50;
        d = `M${a.cx} ${a.cy} Q ${mx} ${my} ${b.cx} ${b.cy}`;
      } else {
        d = `M${a.cx} ${a.cy} L ${b.cx} ${b.cy}`;
      }
      edgeElements[i].setAttribute('d', d);
    }
    frameId = requestAnimationFrame(drawFrame);
  }
  frameId = requestAnimationFrame(drawFrame);

  // Hero graph: type the output, light up each node, then deserialize.
  async function runHero(): Promise<void> {
    const out = query(root, '.wire .out');
    const phase = query(root, '.hud .phase');
    const bytes = query(root, '.hud .bytes');
    while (running()) {
      phase.textContent = 'live graph';
      for (const item of live.values()) {
        item.halo.setAttribute('r', '0');
        item.halo.setAttribute('opacity', '0');
      }
      out.innerHTML = '';
      bytes.textContent = '0 B';
      await wait(1400);
      phase.textContent = 'serialize →';
      const lit = new Set<LiveNode>();
      const step = reduce ? HERO_OUTPUT.length : 2;
      for (let i = 1; i <= HERO_OUTPUT.length && running(); i += step) {
        out.innerHTML = colorizeOutput(HERO_OUTPUT.slice(0, i));
        bytes.textContent = `${i} B`;
        for (const item of live.values()) {
          if (item.at >= 0 && i >= item.at && !lit.has(item)) {
            lit.add(item);
            item.halo.setAttribute('r', '46');
            item.halo.setAttribute('opacity', '0.18');
            orb.setAttribute('cx', String(item.cx));
            orb.setAttribute('cy', String(item.cy));
            orb.setAttribute('opacity', '1');
          }
        }
        await wait(22);
      }
      orb.setAttribute('opacity', '0');
      phase.textContent = 'string';
      await wait(1800);
      phase.textContent = '← deserialize';
      const back = deserialize<HeroUser>(HERO_OUTPUT);
      const restored =
        back.self === back && back.notes.get('by') === back && back.born instanceof Date;
      const reversed = [...live.values()].reverse();
      for (const item of reversed) {
        item.halo.setAttribute('opacity', '0');
        item.halo.setAttribute('r', '0');
        await wait(120);
      }
      phase.textContent = restored ? 'restored · back.self === back ✓' : 'restored';
      await wait(2600);
    }
  }
  runHero().catch(() => undefined);

  // 02: send real stream chunks across the lane.
  const lane = query(root, '.lane');
  const log = query(root, '.log');
  let streamRun = 0;

  async function shoot(text: string, later: boolean): Promise<void> {
    const packet = document.createElement('div');
    packet.className = later ? 'packet later' : 'packet';
    packet.textContent = text;
    lane.appendChild(packet);
    const distance = lane.clientWidth - 260 - packet.offsetWidth;
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

  // 03: show a mode's output one character at a time.
  const modeButtons = root.querySelectorAll<HTMLButtonElement>('.mode-btn');
  function showMode(id: string): void {
    for (const button of modeButtons) {
      button.setAttribute('aria-selected', String(button.dataset.mode === id));
    }
    for (const mode of MODES) {
      if (mode.id !== id) {
        continue;
      }
      const output = mode.render();
      query(root, '.mode-fn').innerHTML = mode.call;
      let html = '';
      let i = 0;
      for (const char of output) {
        html += `<span class="ch" style="animation-delay:${Math.min(i * 3, 900)}ms">${escapeHTML(char)}</span>`;
        i++;
      }
      query(root, '.mode-pre').innerHTML = html;
      query(root, '.mode-size').textContent = `${output.length} B`;
      query(root, '.mode-eval').textContent = mode.needsEval;
      query(root, '.mode-rt').textContent = mode.roundTrips() ? 'self === self ✓' : '—';
    }
  }
  function onModeClick(event: Event): void {
    const button = event.currentTarget;
    if (button instanceof HTMLElement && button.dataset.mode) {
      showMode(button.dataset.mode);
    }
  }
  for (const button of modeButtons) {
    button.addEventListener('click', onModeClick);
  }

  // Install buttons copy the command.
  const installButtons = root.querySelectorAll<HTMLButtonElement>('.install');
  function onInstallClick(event: Event): void {
    const button = event.currentTarget;
    const label = button instanceof HTMLElement ? button.querySelector('.cp') : null;
    navigator.clipboard
      .writeText(INSTALL_COMMAND)
      .then(() => {
        if (label) {
          label.textContent = 'copied';
          setTimeout(() => {
            label.textContent = 'copy';
          }, 1400);
        }
      })
      .catch(() => undefined);
  }
  for (const button of installButtons) {
    button.addEventListener('click', onInstallClick);
  }

  // Reveal sections as they scroll in, and start each demo once.
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
        let order = 0;
        for (const sibling of element.parentElement?.children ?? []) {
          if (sibling === element) {
            break;
          }
          if (sibling.classList.contains('reveal')) {
            order++;
          }
        }
        element.style.transitionDelay = `${order * 70}ms`;
        element.classList.add('in');
        if (element.classList.contains('cmp-row')) {
          setTimeout(() => {
            element.classList.add('in-view');
          }, 200);
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
  for (const element of root.querySelectorAll('.reveal')) {
    observer.observe(element);
  }

  return () => {
    alive = false;
    streamRun++;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    replay.removeEventListener('click', runStream);
    for (const button of modeButtons) {
      button.removeEventListener('click', onModeClick);
    }
    for (const button of installButtons) {
      button.removeEventListener('click', onInstallClick);
    }
  };
}

function InstallButton(props: { class?: string }): JSX.Element {
  return (
    <button type="button" class={['install', props.class]}>
      <span class="p">$</span> {INSTALL_COMMAND} <span class="cp">copy</span>
    </button>
  );
}

function Track(props: { items: string[]; separator: string; reverse?: boolean }): JSX.Element {
  // The items repeat twice so the loop has no visible seam. Each one is
  // wrapped in an object, because For keys items by identity.
  const items: { text: string }[] = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const text of props.items) {
      items.push({ text });
    }
  }
  return (
    <div class={props.reverse ? 'track rev' : 'track'}>
      <For each={items}>
        {(item) => (
          <>
            <span>{item.text}</span>
            <i>{props.separator}</i>
          </>
        )}
      </For>
    </div>
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

      <section class="hero">
        <div>
          <div class="eyebrow">v{SHORT_VERSION} · MIT · zero dependencies</div>
          <h1>
            <span class="line">
              <span>Serialize what</span>
            </span>
            <span class="line">
              <span>
                <span class="tok">JSON</span> <em>can't.</em>
              </span>
            </span>
          </h1>
          <p class="lead">
            seroval turns any JavaScript value into a string and back: <b>cyclic references</b>,{' '}
            <b>Date</b>, <b>Map</b>, <b>Set</b>, <b>BigInt</b>, <b>Promise</b>,{' '}
            <b>ReadableStream</b>. Output as a JS expression, a JSON tree, or a stream.
          </p>
          <div class="cta-row">
            <a class="btn btn-primary" href={FIRST_PAGE.href}>
              Read the docs <span class="arr">→</span>
            </a>
            <InstallButton />
          </div>
        </div>
        <div class="stage">
          <div class="hud">
            <span class="phase">graph</span>
            <span class="bytes">0 B</span>
          </div>
          <svg class="graph" viewBox="0 0 600 440" />
          <div class="wire">
            <span class="label">serialize(user)</span>
            <span class="out" />
            <span class="caret" />
          </div>
        </div>
        <div class="scroll-hint">
          <span />
          Scroll
        </div>
      </section>

      <div class="marquee">
        <Track items={TYPES} separator="·" />
        <Track items={SNIPPETS} separator=" // " reverse />
      </div>

      <section class="chap">
        <div class="chap-head reveal">
          <div class="chap-num">
            <b>01</b> LOSSLESS
          </div>
          <div>
            <h2>
              JSON.stringify drops data. <em>serialize keeps it.</em>
            </h2>
            <p>
              Each row below runs live in your browser: the left column is{' '}
              <code>JSON.stringify</code>, the right is <code>serialize</code>, both from the real
              libraries.
            </p>
          </div>
        </div>
        <div class="cmp">
          <div class="cmp-row hdr">
            <span>Value</span>
            <span>JSON.stringify</span>
            <span>seroval</span>
          </div>
          <For each={COMPARISON_ROWS}>
            {(row) => (
              <div class="cmp-row reveal">
                <span class="in">{row.label}</span>
                <span class="json">
                  <span class="v">{row.json}</span>
                  <span class="why">{row.why}</span>
                </span>
                <span class="sv">{row.output}</span>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="chap">
        <div class="chap-head reveal">
          <div class="chap-num">
            <b>02</b> STREAMING
          </div>
          <div>
            <h2>
              Stream values <em>as they resolve.</em>
            </h2>
            <p>
              The synchronous part ships first. Promises follow the moment they settle. The page
              renders now and fills in later. Below, real chunks from{' '}
              <code>crossSerializeStream</code>.
            </p>
          </div>
        </div>
        <div class="stream reveal">
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
              <div class="k">posts — 1.2 s</div>
              <div class="v pending cv-posts" />
            </div>
            <div class="cv">
              <div class="k">recommended — 2.4 s</div>
              <div class="v pending cv-rec" />
            </div>
          </div>
          <div class="log" />
          <button type="button" class="replay">
            ↻ Replay stream
          </button>
        </div>
      </section>

      <section class="chap">
        <div class="chap-head reveal">
          <div class="chap-num">
            <b>03</b> OUTPUT
          </div>
          <div>
            <h2>
              Three output formats. <em>Same references.</em>
            </h2>
            <p>Pick the format that fits the wire. Same graph, same references, every time.</p>
          </div>
        </div>
        <div class="modes reveal">
          <div class="mode-list" role="tablist">
            <For each={MODES}>
              {(mode, index) => (
                <button
                  type="button"
                  class="mode-btn"
                  role="tab"
                  aria-selected={index() === 0 ? 'true' : 'false'}
                  data-mode={mode.id}
                >
                  <span class="n">{mode.letter}</span>
                  <span class="t">{mode.title}</span>
                  <span class="d">{mode.description}</span>
                </button>
              )}
            </For>
          </div>
          <div class="mode-out">
            <div class="mode-fn" />
            <pre class="mode-pre" />
            <div class="meta">
              <span>
                Size
                <b class="mode-size" />
              </span>
              <span>
                Needs eval
                <b class="mode-eval" />
              </span>
              <span>
                Round-trip
                <b class="mode-rt" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="trust">
        <div class="chap-num">
          <b>04</b> USED BY
        </div>
        <div class="names reveal">
          <span>SolidJS</span>
          <span>
            <em>/</em>
          </span>
          <span>TanStack Start</span>
        </div>
      </section>

      <section class="finale">
        <div class="orb" />
        <h2 class="reveal">
          Send more than <span class="tok">JSON</span>.
        </h2>
        <InstallButton class="big-install reveal" />
      </section>
    </div>
  );
}
