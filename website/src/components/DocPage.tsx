import type { JSX } from '@solidjs/web';
import { type Component, For, Show, createSignal, onSettled } from 'solid-js';
import { getSectionTitle, getSiblings } from '../lib/docs';
import { syncPackageManagerButtons } from '../lib/package-manager';
import { placeThumbs } from '../lib/thumb';
import { REPOSITORY_URL } from '../lib/ui';
import DocsNav from './DocsNav';
import { GithubIcon } from './Icons';
import PageMeta from './PageMeta';

export interface RenderedDoc {
  slug: string;
  title: string;
  description: string;
  html: string;
  headings: { depth: number; text: string; id: string }[];
  file: string;
}

/** The table of contents, with the section in view marked. */
function TableOfContents(props: { doc: RenderedDoc }): JSX.Element {
  const [active, setActive] = createSignal<string>();
  const headings = (): RenderedDoc['headings'] => props.doc.headings.filter((h) => h.depth <= 3);
  // A page with a single section needs no table of contents.
  const sections = (): number => headings().filter((h) => h.depth === 2).length;

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
    <Show when={sections() >= 2}>
      <aside class="docs-toc">
        <nav aria-label="On this page">
          <p class="toc-label">On this page</p>
          <ul class="toc-list">
            <For each={headings()}>
              {(heading) => (
                <li class={heading.depth === 3 ? 'toc-sub' : undefined}>
                  <a
                    href={`#${heading.id}`}
                    aria-current={active() === heading.id ? 'true' : undefined}
                  >
                    {heading.text}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </nav>
      </aside>
    </Show>
  );
}

/** The layout for a page built from a doc in `src/content/docs`. */
export default function DocPage(props: { doc: RenderedDoc }): JSX.Element {
  const siblings = (): ReturnType<typeof getSiblings> => getSiblings(props.doc.slug);

  // Install commands in the doc are prerendered with npm chosen.
  onSettled(() => {
    syncPackageManagerButtons();
    placeThumbs();
  });

  return (
    <div class="docs">
      <PageMeta title={props.doc.title} description={props.doc.description} />
      <aside class="docs-sidebar">
        <DocsNav />
      </aside>
      <div class="docs-main">
        <header class="doc-head">
          <div class="doc-head-meta">
            <p class="crumb">{getSectionTitle(props.doc.slug)}</p>
            <a
              class="edit-link"
              href={`${REPOSITORY_URL}/edit/main/${props.doc.file}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon />
              Edit this page
            </a>
          </div>
          <h1>{props.doc.title}</h1>
          <p class="lead">{props.doc.description}</p>
        </header>
        <article class="prose" innerHTML={props.doc.html} />
        <nav class="pager" aria-label="Pages">
          <Show when={siblings().previous}>
            {(previous) => (
              <a rel="prev" href={previous().href}>
                <span class="pager-dir">Previous</span>
                {previous().title}
              </a>
            )}
          </Show>
          <Show when={siblings().next}>
            {(next) => (
              <a rel="next" href={next().href}>
                <span class="pager-dir">Next</span>
                {next().title}
              </a>
            )}
          </Show>
        </nav>
      </div>
      <TableOfContents doc={props.doc} />
    </div>
  );
}

/** Creates the page component for a rendered doc. */
export function createDocPage(doc: RenderedDoc): Component {
  return () => <DocPage doc={doc} />;
}
