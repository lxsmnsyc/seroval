import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Marked, type Tokens } from 'marked';
import markedFootnote from 'marked-footnote';
import type { Plugin, ViteDevServer } from 'vite';
import { parse as parseYAML } from 'yaml';
import { codeFrame, escapeHTML, highlight } from './highlight.ts';
import { renderShowcase } from './showcase.ts';

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export interface RenderedDoc {
  slug: string;
  title: string;
  description: string;
  html: string;
  headings: Heading[];
  /** Path of the source file, relative to the repository root. */
  file: string;
}

export interface SearchEntry {
  id: string;
  slug: string;
  page: string;
  heading: string;
  text: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TSX',
  json: 'JSON',
  bash: 'Terminal',
  sh: 'Terminal',
  html: 'HTML',
  css: 'CSS',
  text: 'Text',
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;
const ALERT_MARKER = /^<p>\[!\w+\]\s*/;
const HTML_TAG = /<[^>]+>/g;
const NON_SLUG_CHARACTER = /[^\w\s-]/g;
const WHITESPACE = /\s+/g;
const ABSOLUTE_LINK = /^[a-z]+:|^#|^\//i;
const EXTERNAL_LINK = /^https?:/;
const CODE_TITLE = /title="([^"]*)"/;
const HEADING_SPLIT = /<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
const ENTITY = /&(amp|lt|gt|quot|#39);/g;
const CODE_PLACEHOLDER = /<!--code:(\d+)-->/g;
const ANCHOR_PREFIX = /^#\s*/;
const CODE_HEADER = /<div class="code-header">[\s\S]*?<\/div>/g;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
};

const ALERT_ICONS: Record<string, string> = {
  note: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6V16h5.6v-.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"/>',
  important: '<path d="M4 4h16v12H8l-4 4z"/><path d="M12 8v3M12 13.5h.01"/>',
  warning: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  caution: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16h.01"/>',
};

const REPOSITORY = 'https://github.com/lxsmnsyc/seroval/blob/main/';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(HTML_TAG, '')
    .replace(NON_SLUG_CHARACTER, '')
    .trim()
    .replace(WHITESPACE, '-');
}

function toText(html: string): string {
  return html
    .replace(CODE_HEADER, ' ')
    .replace(HTML_TAG, ' ')
    .replace(ENTITY, (_, name: string) => ENTITIES[name])
    .replace(WHITESPACE, ' ')
    .trim();
}

// Links between docs point at their pages on the site. Other relative links
// point at the file in the repository.
function rewriteLink(href: string, file: string): string {
  if (ABSOLUTE_LINK.test(href)) {
    return href;
  }
  const [target, hash] = href.split('#');
  if (target === '') {
    return href;
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
  if (resolved.startsWith('website/src/content/docs/') && resolved.endsWith('.md')) {
    const slug = path.posix.basename(resolved, '.md');
    return `/docs/${slug}${hash ? `#${hash}` : ''}`;
  }
  return REPOSITORY + resolved + (hash ? `#${hash}` : '');
}

/**
 * Renders a doc into HTML, with highlighted code blocks, heading anchors,
 * GitHub-style alerts and footnotes. `file` is the path relative to the
 * repository root, used to resolve relative links.
 */
async function renderDoc(source: string, file: string): Promise<RenderedDoc> {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    throw new Error(`${file} has no frontmatter`);
  }
  const meta = parseYAML(match[1]) as { title?: string; description?: string };
  if (!(meta.title && meta.description)) {
    throw new Error(`${file} needs a title and a description`);
  }
  const body = source.slice(match[0].length);

  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const codeBlocks: Promise<string>[] = [];

  const marked = new Marked({ gfm: true });
  marked.use(markedFootnote());
  marked.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const html = this.parser.parseInline(token.tokens);
        const base = slugify(token.text);
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        headings.push({
          depth: token.depth,
          text: toText(html),
          id,
        });
        return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${html}</h${token.depth}>`;
      },
      code(token: Tokens.Code) {
        const [lang = 'text', ...rest] = (token.lang ?? '').split(WHITESPACE);
        const title = CODE_TITLE.exec(rest.join(' '))?.[1];
        const index = codeBlocks.length;
        codeBlocks.push(
          highlight(token.text, lang).then((html) =>
            codeFrame(html, title ?? LANGUAGE_LABELS[lang] ?? lang),
          ),
        );
        return `<!--code:${index}-->`;
      },
      link(token: Tokens.Link) {
        const html = this.parser.parseInline(token.tokens);
        const href = rewriteLink(token.href, file);
        const external = EXTERNAL_LINK.test(href);
        const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHTML(href)}"${attributes}>${html}</a>`;
      },
      table(token: Tokens.Table) {
        const head = token.header
          .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
          .join('');
        const rows = token.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`,
          )
          .join('');
        return `<div class="table-wrapper"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
      },
      blockquote(token: Tokens.Blockquote) {
        const content = this.parser.parse(token.tokens);
        const alert = ALERT_PATTERN.exec(token.text);
        if (alert) {
          const kind = alert[1].toLowerCase();
          const label = kind[0].toUpperCase() + kind.slice(1);
          const icon = `<svg viewBox="0 0 24 24" aria-hidden="true">${ALERT_ICONS[kind]}</svg>`;
          return `<div class="alert alert-${kind}"><p class="alert-title">${icon}${label}</p>${content.replace(ALERT_MARKER, '<p>')}</div>`;
        }
        return `<blockquote>${content}</blockquote>`;
      },
    },
  });

  let html = await marked.parse(body);
  const highlighted = await Promise.all(codeBlocks);
  html = html.replace(CODE_PLACEHOLDER, (_, index: string) => highlighted[Number(index)]);

  return {
    slug: path.posix.basename(file, '.md'),
    title: meta.title,
    description: meta.description,
    html,
    headings,
    file,
  };
}

// Splits a page into one search entry per section.
function createSearchEntries(doc: RenderedDoc): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const parts = doc.html.split(HEADING_SPLIT);
  entries.push({
    id: doc.slug,
    slug: doc.slug,
    page: doc.title,
    heading: doc.title,
    text: `${doc.description} ${toText(parts[0])}`,
  });
  // `split` with capture groups yields [before, depth, id, heading, body, ...].
  for (let i = 1; i < parts.length; i += 4) {
    entries.push({
      id: `${doc.slug}#${parts[i + 1]}`,
      slug: doc.slug,
      page: doc.title,
      heading: toText(parts[i + 2]).replace(ANCHOR_PREFIX, ''),
      text: toText(parts[i + 3] ?? ''),
    });
  }
  return entries;
}

const MANIFEST_ID = 'virtual:docs-manifest';
const SEARCH_ID = 'virtual:search-index';
const SHOWCASE_ID = 'virtual:showcase';

/**
 * Serves the docs in `src/content/docs`:
 *
 * - Importing a doc gives `{ doc }` and a default page component.
 * - `virtual:docs-manifest` lists every doc's slug, title and description.
 * - `virtual:search-index` holds the text of every section, for search.
 * - `virtual:showcase` holds the home page examples, serialized at build time.
 */
export default function content(root: string): Plugin {
  const docsDir = path.join(import.meta.dirname, '../src/content/docs');

  async function loadDocs(): Promise<RenderedDoc[]> {
    const files = (await readdir(docsDir)).filter((name) => name.endsWith('.md'));
    return Promise.all(
      files.map(async (name) => {
        const id = path.join(docsDir, name);
        const relative = path.relative(root, id).split(path.sep).join('/');
        return renderDoc(await readFile(id, 'utf8'), relative);
      }),
    );
  }

  let server: ViteDevServer | undefined;

  return {
    name: 'seroval-content',
    enforce: 'pre',
    configureServer(devServer) {
      server = devServer;
      // A change to any doc can change the manifest and the search index.
      devServer.watcher.add(docsDir);
    },
    handleHotUpdate(context) {
      if (context.file.startsWith(docsDir) && server) {
        for (const id of [`\0${MANIFEST_ID}`, `\0${SEARCH_ID}`]) {
          const module = server.moduleGraph.getModuleById(id);
          if (module) {
            server.moduleGraph.invalidateModule(module);
          }
        }
      }
    },
    resolveId(id) {
      if (id === MANIFEST_ID || id === SEARCH_ID || id === SHOWCASE_ID) {
        return `\0${id}`;
      }
      return null;
    },
    async load(id) {
      if (id === `\0${MANIFEST_ID}`) {
        const docs = await loadDocs();
        const manifest = Object.fromEntries(
          docs.map((doc) => [doc.slug, { title: doc.title, description: doc.description }]),
        );
        return `export default ${JSON.stringify(manifest)};`;
      }
      if (id === `\0${SEARCH_ID}`) {
        const docs = await loadDocs();
        return `export default ${JSON.stringify(docs.flatMap(createSearchEntries))};`;
      }
      if (id === `\0${SHOWCASE_ID}`) {
        return `export default ${JSON.stringify(await renderShowcase())};`;
      }
      if (!id.endsWith('.md')) {
        return null;
      }
      const file = path.relative(root, id).split(path.sep).join('/');
      const doc = await renderDoc(await readFile(id, 'utf8'), file);
      // The module imports only from the site's own sources, which resolve
      // its dependencies.
      return [
        "import { createDocPage } from '/src/components/DocPage';",
        `export const doc = ${JSON.stringify(doc)};`,
        'export default createDocPage(doc);',
      ].join('\n');
    },
  };
}
