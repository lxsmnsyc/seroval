import { type Component, For, Show } from 'solid-js';
import { DOCS } from '../docs';
import PageMeta from './PageMeta';

export interface RenderedDoc {
  title: string;
  html: string;
  headings: { depth: number; text: string; id: string }[];
}

/** The layout for a page built from a Markdown file in `docs/`. */
export default function DocPage(props: { doc: RenderedDoc }) {
  return (
    <div class="docs-layout">
      <PageMeta
        title={props.doc.title}
        description={
          DOCS.find(entry => entry.title === props.doc.title)?.description ??
          props.doc.title
        }
      />
      <aside class="docs-sidebar">
        <p class="sidebar-title">Guides</p>
        <nav>
          <For each={DOCS}>
            {entry => <a href={`/docs/${entry.slug}`}>{entry.title}</a>}
          </For>
        </nav>
      </aside>
      <article class="prose" innerHTML={props.doc.html} />
      <Show when={props.doc.headings.length > 0}>
        <aside class="docs-toc">
          <p class="sidebar-title">On this page</p>
          <nav>
            <For each={props.doc.headings.filter(h => h.depth <= 3)}>
              {heading => (
                <a
                  href={`#${heading.id}`}
                  class={{ nested: heading.depth === 3 }}
                >
                  {heading.text}
                </a>
              )}
            </For>
          </nav>
        </aside>
      </Show>
    </div>
  );
}

/** Creates the page component for a rendered Markdown file. */
export function createDocPage(doc: RenderedDoc): Component {
  return () => <DocPage doc={doc} />;
}
