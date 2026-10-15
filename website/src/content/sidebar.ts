export interface SidebarSection {
  title: string;
  /** Doc slugs, which are file names in `src/content/docs` without `.md`. */
  pages: string[];
}

/** The docs in sidebar order. Every doc must be listed here. */
export const SIDEBAR: SidebarSection[] = [
  {
    title: 'Getting started',
    pages: ['introduction', 'quick-start', 'choosing-a-mode'],
  },
  {
    title: 'Guides',
    pages: [
      'javascript-output',
      'json',
      'cross-reference',
      'streaming',
      'streams-and-iterables',
      'isomorphic-references',
      'binary-data',
    ],
  },
  {
    title: 'Plugins',
    pages: ['using-plugins', 'writing-plugins', 'plugin-security'],
  },
  {
    title: 'Reference',
    pages: ['api', 'compatibility', 'errors', 'security'],
  },
];
