import { type Component, lazy } from 'solid-js';
import manifest from 'virtual:docs-manifest';
import { SIDEBAR } from '../content/sidebar';

export interface DocLink {
  slug: string;
  title: string;
  description: string;
  href: string;
}

const modules = import.meta.glob<{ default: Component }>(
  '../content/docs/**/*.md',
);

function toLink(slug: string): DocLink {
  const entry = manifest[slug];
  if (!entry) {
    throw new Error(`The sidebar lists "${slug}", which has no doc.`);
  }
  return { slug, ...entry, href: `/docs/${slug}` };
}

const ALL_SECTIONS = SIDEBAR.map(section => ({
  title: section.title,
  hidden: section.hidden === true,
  pages: section.pages.map(toLink),
}));

/** The sections the sidebar shows. */
export const SECTIONS = ALL_SECTIONS.filter(section => !section.hidden);

/** Every doc, hidden ones included, in sidebar order. */
export const PAGES: DocLink[] = ALL_SECTIONS.flatMap(section => section.pages);

/** The docs the pager steps through: the ones the sidebar shows. */
const PAGER: DocLink[] = SECTIONS.flatMap(section => section.pages);

export const FIRST_PAGE = PAGES[0];

/** Returns the docs before and after `slug`, for page navigation. */
export function getSiblings(slug: string): {
  previous?: DocLink;
  next?: DocLink;
} {
  const index = PAGER.findIndex(page => page.slug === slug);
  if (index === -1) {
    return {};
  }
  return { previous: PAGER[index - 1], next: PAGER[index + 1] };
}

export function getSectionTitle(slug: string): string | undefined {
  return ALL_SECTIONS.find(section =>
    section.pages.some(page => page.slug === slug),
  )?.title;
}

/** Page components, loaded on demand. */
export const DOC_ROUTES = PAGES.map(page => {
  const load = modules[`../content/docs/${page.slug}.md`];
  return { path: page.href, component: lazy(load) };
});
