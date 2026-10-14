import { For } from 'solid-js';
import { doc as example } from '../content/example.md';
import PageMeta from '../components/PageMeta';
import { DOCS } from '../docs';

const FEATURES = [
  {
    title: 'More than JSON',
    body: 'Dates, Maps, Sets, BigInt, typed arrays, errors, -0, NaN, sparse arrays and well-known symbols.',
  },
  {
    title: 'References kept',
    body: 'Shared and cyclic references come back as the same objects, not copies.',
  },
  {
    title: 'Async and streaming',
    body: 'Promises, async iterables and streams are sent as they settle, chunk by chunk.',
  },
  {
    title: 'Several output formats',
    body: 'A JavaScript expression, a JSON tree, or cross-reference chunks shared across payloads.',
  },
  {
    title: 'Plugins',
    body: 'Add your own types. seroval-plugins covers web types such as Request, Response, File and Headers.',
  },
  {
    title: 'Built for frameworks',
    body: 'Used to send server state to the client in SSR frameworks.',
  },
];

export default function Home() {
  return (
    <div class="home">
      <PageMeta description="Serialize JavaScript values that JSON cannot: cyclic references, Dates, Maps, promises, streams and more." />
      <section class="hero">
        <h1>seroval</h1>
        <p class="tagline">
          Serialize JavaScript values that JSON cannot: cyclic references,
          Dates, Maps, promises, streams and more.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="/docs/serialization">
            Read the docs
          </a>
          <a class="button" href="/playground">
            Open the playground
          </a>
        </div>
        <pre class="install">
          <code>npm install seroval</code>
        </pre>
      </section>
      <section class="example prose" innerHTML={example.html} />
      <section class="features">
        <For each={FEATURES}>
          {feature => (
            <div class="feature">
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </div>
          )}
        </For>
      </section>
      <section class="guides">
        <h2>Guides</h2>
        <div class="guide-list">
          <For each={DOCS}>
            {entry => (
              <a class="guide" href={`/docs/${entry.slug}`}>
                <span class="guide-title">{entry.title}</span>
                <span class="guide-description">{entry.description}</span>
              </a>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
