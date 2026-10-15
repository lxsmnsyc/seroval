import type { JSX } from '@solidjs/web';
import { type Component, For, Show, createSignal, onSettled } from 'solid-js';
import { getSectionTitle, getSiblings } from '../lib/docs';
import { REPOSITORY_URL } from '../lib/ui';
import DocsNav from './DocsNav';
import { ArrowLeftIcon, ArrowRightIcon, EditIcon } from './Icons';
import PageMeta from './PageMeta';

export interface RenderedDoc {
  slug: string;
  title: string;
  description: string;
  html: string;
  headings: { depth: number; text: string; id: string }[];
  file: string;
}

/** The table of contents, with the section in view highlighted. */
function TableOfContents(props: { doc: RenderedDoc }): JSX.Element {
  const [active, setActive] = createSignal<string>();
  const headings = (): RenderedDoc['headings'] => props.doc.headings.filter((h) => h.depth <= 3);

  onSettled(() => {
    const elements = headings()
      .map((heading) => document.getElementById(heading.id))
      .filter((element) => element != null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    for (const element of elements) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
    };
  });

  return (
    <Show when={headings().length > 0}>
      <aside class="docs-toc">
        <p class="docs-nav-title">On this page</p>
        <nav aria-label="On this page">
          <For each={headings()}>
            {(heading) => (
              <a
                href={`#${heading.id}`}
                class={{
                  nested: heading.depth === 3,
                  current: active() === heading.id,
                }}
              >
                {heading.text}
              </a>
            )}
          </For>
        </nav>
      </aside>
    </Show>
  );
}

/** The layout for a page built from a doc in `src/content/docs`. */
export default function DocPage(props: { doc: RenderedDoc }): JSX.Element {
  const siblings = (): ReturnType<typeof getSiblings> => getSiblings(props.doc.slug);

  return (
    <div class="docs-layout">
      <PageMeta title={props.doc.title} description={props.doc.description} />
      <aside class="docs-sidebar">
        <DocsNav />
      </aside>
      <div class="docs-main">
        <header class="docs-header">
          <p class="docs-eyebrow">{getSectionTitle(props.doc.slug)}</p>
          <h1>{props.doc.title}</h1>
          <p class="docs-lead">{props.doc.description}</p>
        </header>
        <article class="prose" innerHTML={props.doc.html} />
        <footer class="docs-footer">
          <a
            class="edit-link"
            href={`${REPOSITORY_URL}/edit/main/${props.doc.file}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <EditIcon />
            Edit this page on GitHub
          </a>
          <nav class="pager" aria-label="Pages">
            <Show when={siblings().previous}>
              {(previous) => (
                <a class="pager-link previous" href={previous().href}>
                  <span class="pager-label">
                    <ArrowLeftIcon /> Previous
                  </span>
                  <span class="pager-title">{previous().title}</span>
                </a>
              )}
            </Show>
            <Show when={siblings().next}>
              {(next) => (
                <a class="pager-link next" href={next().href}>
                  <span class="pager-label">
                    Next <ArrowRightIcon />
                  </span>
                  <span class="pager-title">{next().title}</span>
                </a>
              )}
            </Show>
          </nav>
        </footer>
      </div>
      <TableOfContents doc={props.doc} />
    </div>
  );
}

/** Creates the page component for a rendered doc. */
export function createDocPage(doc: RenderedDoc): Component {
  return () => <DocPage doc={doc} />;
}
