export interface SidebarSection {
  title: string;
  /** Doc slugs, which are paths in `src/content/docs` without `.md`. */
  pages: string[];
  /** Routed but left out of the sidebar and the pager, such as pages an index links. */
  hidden?: boolean;
}

/** The docs in sidebar order. Every doc must be listed here. */
export const SIDEBAR: SidebarSection[] = [
  {
    title: 'Getting started',
    pages: ['introduction', 'quick-start', 'choosing-a-mode'],
  },
  {
    title: 'Concepts',
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
    title: 'Packages',
    pages: [
      'transport',
      'transport/reference',
      'transport/protocol',
      'rpc',
      'rpc/reference',
      'rpc/protocol',
    ],
  },
  {
    title: 'Reference',
    pages: ['api', 'compatibility', 'errors', 'security'],
  },
  {
    title: 'Migration',
    pages: ['migration/1-9'],
  },
  {
    title: 'Error codes',
    hidden: true,
    pages: [
      'errors/SRV001',
      'errors/SRV002',
      'errors/SRV003',
      'errors/SRV004',
      'errors/SRV005',
      'errors/SRV006',
      'errors/SRV007',
      'errors/SRV008',
      'errors/SRV009',
      'errors/SRV010',
      'errors/SRV011',
      'errors/SRV012',
      'errors/SRV013',
      'errors/SRV014',
      'errors/SRV015',
      'errors/SRV016',
      'errors/SRV017',
      'errors/SRV018',
      'errors/SRV019',
      'errors/SRV020',
    ],
  },
];
