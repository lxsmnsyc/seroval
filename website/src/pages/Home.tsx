import type { JSX } from '@solidjs/web';
import { For, createSignal } from 'solid-js';
import { Tab, TabGroup, TabList, TabPanel } from 'terracotta/tabs';
import showcase from 'virtual:showcase';
import {
  ArrowRightIcon,
  BracesIcon,
  CycleIcon,
  LayersIcon,
  PlayIcon,
  PlugIcon,
  ShieldIcon,
  StreamIcon,
} from '../components/Icons';
import PageMeta from '../components/PageMeta';
import { FIRST_PAGE } from '../lib/docs';

const PACKAGE_MANAGERS = [
  { id: 'npm', command: 'npm install seroval' },
  { id: 'pnpm', command: 'pnpm add seroval' },
  { id: 'yarn', command: 'yarn add seroval' },
  { id: 'bun', command: 'bun add seroval' },
];

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
  'Symbol.iterator',
  'AsyncIterable',
  'Object.create(null)',
  'NaN',
  '-0',
  'Infinity',
  'undefined',
  'sparse arrays',
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

const FEATURES = [
  {
    icon: BracesIcon,
    title: 'Beyond JSON',
    body: 'Dates, Maps, Sets, BigInts, typed arrays, errors, symbols and the numbers JSON drops, like NaN and -0.',
    href: '/docs/compatibility',
  },
  {
    icon: CycleIcon,
    title: 'References kept',
    body: 'Shared and cyclic references come back as the same objects, not copies, and never loop forever.',
    href: '/docs/javascript-output',
  },
  {
    icon: StreamIcon,
    title: 'Async and streaming',
    body: 'Promises, async iterables and streams are sent as they settle, one chunk at a time.',
    href: '/docs/streaming',
  },
  {
    icon: LayersIcon,
    title: 'Three output formats',
    body: 'A JavaScript expression, a JSON tree that needs no eval, or cross-reference scripts that share values across payloads.',
    href: '/docs/choosing-a-mode',
  },
  {
    icon: PlugIcon,
    title: 'Extensible',
    body: 'Write plugins for your own types. seroval-plugins covers Request, Response, FormData, Blob and more.',
    href: '/docs/using-plugins',
  },
  {
    icon: ShieldIcon,
    title: 'Safe to receive',
    body: 'fromJSON validates every node and caps the work a payload can cause, so it can decode untrusted input.',
    href: '/docs/security',
  },
];

function InstallCommand(): JSX.Element {
  const [copied, setCopied] = createSignal<string>();

  function copy(id: string, command: string): void {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(id);
      setTimeout(() => {
        setCopied(undefined);
      }, 1500);
    });
  }

  return (
    <TabGroup<string> class="install" horizontal={true} defaultValue="npm">
      <TabList class="install-tabs" aria-label="Package manager">
        <For each={PACKAGE_MANAGERS}>
          {(manager) => (
            <Tab class="install-tab" value={manager.id}>
              {manager.id}
            </Tab>
          )}
        </For>
      </TabList>
      <For each={PACKAGE_MANAGERS}>
        {(manager) => (
          <TabPanel class="install-panel" value={manager.id}>
            <code>
              <span class="prompt">$</span> {manager.command}
            </code>
            <button
              type="button"
              class="copy-button"
              onClick={() => {
                copy(manager.id, manager.command);
              }}
            >
              {copied() === manager.id ? 'Copied' : 'Copy'}
            </button>
          </TabPanel>
        )}
      </For>
    </TabGroup>
  );
}

function Showcase(): JSX.Element {
  return (
    <TabGroup<string> class="showcase" horizontal={true} defaultValue={showcase[0].id}>
      <TabList class="showcase-tabs" aria-label="Output format">
        <For each={showcase}>
          {(example) => (
            <Tab class="showcase-tab" value={example.id}>
              {example.label}
            </Tab>
          )}
        </For>
      </TabList>
      <For each={showcase}>
        {(example) => (
          <TabPanel class="showcase-panel" value={example.id}>
            <p class="showcase-description">{example.description}</p>
            <div class="showcase-grid">
              <div innerHTML={example.input} />
              <div class="showcase-output" innerHTML={example.output} />
            </div>
          </TabPanel>
        )}
      </For>
    </TabGroup>
  );
}

export default function Home(): JSX.Element {
  return (
    <div class="home">
      <PageMeta description="Serialize the JavaScript values JSON cannot: cyclic references, Dates, Maps, promises, streams and more." />

      <section class="hero">
        <div class="hero-glow" aria-hidden="true" />
        <p class="hero-badge">
          Powers server rendering in <strong>SolidJS</strong> and <strong>TanStack Start</strong>
        </p>
        <h1 class="hero-title">
          Serialize the values <span class="gradient-text">JSON can't.</span>
        </h1>
        <p class="hero-lead">
          seroval turns any JavaScript value into a string and back: cyclic references, Dates, Maps,
          promises, streams and more. Stream it to the browser as it resolves, or send it as JSON
          that is safe to receive.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href={FIRST_PAGE.href}>
            Get started <ArrowRightIcon />
          </a>
          <a class="button button-secondary" href="/playground">
            <PlayIcon /> Try the playground
          </a>
        </div>
        <InstallCommand />
      </section>

      <section class="section">
        <Showcase />
      </section>

      <section class="section">
        <div class="section-heading">
          <h2>Everything a value can hold</h2>
          <p>
            Built-in types work out of the box. Web types come from{' '}
            <a href="/docs/using-plugins">seroval-plugins</a>.
          </p>
        </div>
        <ul class="type-cloud">
          <For each={TYPES}>{(type) => <li>{type}</li>}</For>
        </ul>
      </section>

      <section class="section">
        <div class="feature-grid">
          <For each={FEATURES}>
            {(feature) => (
              <a class="feature-card" href={feature.href}>
                <span class="feature-icon">
                  <feature.icon />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </a>
            )}
          </For>
        </div>
      </section>

      <section class="section cta">
        <h2>Ready to send more than JSON?</h2>
        <p>Read the quick start, or open the playground and paste a value.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/docs/quick-start">
            Quick start <ArrowRightIcon />
          </a>
          <a class="button button-secondary" href="/playground">
            Playground
          </a>
        </div>
      </section>
    </div>
  );
}
