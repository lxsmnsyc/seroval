import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Marked, type Tokens } from 'marked';
import markedFootnote from 'marked-footnote';
import { createHighlighter, type Highlighter } from 'shiki';
import type { Plugin } from 'vite';

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

const LANGUAGES = ['js', 'ts', 'tsx', 'json', 'bash', 'sh', 'html', 'css'];

const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;
const ALERT_MARKER = /^<p>\[!\w+\]\s*/;
const HTML_TAG = /<[^>]+>/g;
const NON_SLUG_CHARACTER = /[^\w\s-]/g;
const WHITESPACE = /\s+/g;
const ABSOLUTE_LINK = /^[a-z]+:|^#|^\//i;
const EXTERNAL_LINK = /^https?:/;

const REPOSITORY = 'https://github.com/lxsmnsyc/seroval/blob/main/';

let highlighter: Promise<Highlighter> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: LANGUAGES,
  });
  return highlighter;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(HTML_TAG, '')
    .replace(NON_SLUG_CHARACTER, '')
    .trim()
    .replace(WHITESPACE, '-');
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Links between Markdown files in `docs/` point at their pages on the site.
// Other relative links point at the file in the repository.
function rewriteLink(href: string, file: string): string {
  if (ABSOLUTE_LINK.test(href)) {
    return href;
  }
  const [target, hash] = href.split('#');
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(file), target),
  );
  if (resolved.startsWith('docs/') && resolved.endsWith('.md')) {
    const slug = resolved.slice('docs/'.length, -'.md'.length);
    return `/docs/${slug}${hash ? `#${hash}` : ''}`;
  }
  return REPOSITORY + resolved + (hash ? `#${hash}` : '');
}

/**
 * Renders a Markdown file into HTML, with highlighted code blocks, heading
 * anchors and GitHub-style alerts. `file` is the path relative to the
 * repository root, used to resolve relative links.
 */
async function renderMarkdown(source: string, file: string) {
  const shiki = await getHighlighter();
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let title = '';

  const marked = new Marked({ gfm: true });
  marked.use(markedFootnote());
  marked.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const html = this.parser.parseInline(token.tokens);
        const text = token.text;
        if (token.depth === 1) {
          title ||= text.replaceAll('`', '');
          return `<h1>${html}</h1>`;
        }
        const base = slugify(text);
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        headings.push({
          depth: token.depth,
          text: text.replaceAll('`', ''),
          id,
        });
        return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}">${html}</a></h${token.depth}>`;
      },
      code(token: Tokens.Code) {
        const lang = token.lang?.split(WHITESPACE)[0] || 'text';
        const html = LANGUAGES.includes(lang)
          ? shiki.codeToHtml(token.text, {
              lang,
              themes: { light: 'github-light', dark: 'github-dark' },
              defaultColor: false,
            })
          : `<pre class="shiki"><code>${escapeHTML(token.text)}</code></pre>`;
        return `<div class="code-block" data-lang="${lang}">${html}</div>`;
      },
      link(token: Tokens.Link) {
        const html = this.parser.parseInline(token.tokens);
        const href = rewriteLink(token.href, file);
        const external = EXTERNAL_LINK.test(href);
        const attributes = external
          ? ' target="_blank" rel="noopener noreferrer"'
          : '';
        return `<a href="${escapeHTML(href)}"${attributes}>${html}</a>`;
      },
      blockquote(token: Tokens.Blockquote) {
        const body = this.parser.parse(token.tokens);
        const match = ALERT_PATTERN.exec(token.text);
        if (match) {
          const kind = match[1].toLowerCase();
          const label = kind[0].toUpperCase() + kind.slice(1);
          const content = body.replace(ALERT_MARKER, '<p>');
          return `<div class="alert alert-${kind}"><p class="alert-title">${label}</p>${content}</div>`;
        }
        return `<blockquote>${body}</blockquote>`;
      },
    },
  });

  const html = await marked.parse(source);
  return { title, html, headings };
}

/**
 * Lets the site import a Markdown file as a page component. The module
 * exports the rendered `doc` (`{ title, html, headings }`) and a default
 * component that renders it with `DocPage`.
 */
export default function markdown(root: string): Plugin {
  return {
    name: 'seroval-markdown',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith('.md')) {
        return null;
      }
      const source = await readFile(id, 'utf8');
      const file = path.relative(root, id).split(path.sep).join('/');
      const result = await renderMarkdown(source, file);
      // Docs live outside the site, so the module only imports from the
      // site's own sources, which resolve its dependencies.
      return [
        "import { createDocPage } from '/src/components/DocPage';",
        `export const doc = ${JSON.stringify(result)};`,
        'export default createDocPage(doc);',
      ].join('\n');
    },
  };
}
