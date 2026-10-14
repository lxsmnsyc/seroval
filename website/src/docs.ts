import { type Component, lazy } from 'solid-js';

export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  page: Component;
}

/** The pages built from `docs/*.md`, in sidebar order. */
export const DOCS: DocEntry[] = [
  {
    slug: 'serialization',
    title: 'Serialization',
    description:
      'Every serialization mode: sync, async, cross-reference, streaming, JSON and plugins.',
    page: lazy(() => import('../../docs/serialization.md')),
  },
  {
    slug: 'compatibility',
    title: 'Compatibility',
    description:
      'Supported types, feature flags and how to target older runtimes.',
    page: lazy(() => import('../../docs/compatibility.md')),
  },
  {
    slug: 'isomorphic-refs',
    title: 'Isomorphic references',
    description:
      'Send functions and other values by a shared key with createReference.',
    page: lazy(() => import('../../docs/isomorphic-refs.md')),
  },
];
