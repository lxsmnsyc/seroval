import { type Highlighter, createHighlighter } from 'shiki';

const LANGUAGES = ['js', 'ts', 'tsx', 'json', 'bash', 'sh', 'html', 'css'];

let highlighter: Promise<Highlighter> | undefined;

async function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: LANGUAGES,
  });
  return highlighter;
}

export function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Highlights code for both color themes. */
export async function highlight(code: string, lang: string): Promise<string> {
  if (!LANGUAGES.includes(lang)) {
    return `<pre class="shiki"><code>${escapeHTML(code)}</code></pre>`;
  }
  const shiki = await getHighlighter();
  return shiki.codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}

/** Wraps highlighted code in a frame with a label and a copy button. */
export function codeFrame(html: string, label: string): string {
  return [
    '<div class="code-block">',
    '<div class="code-header">',
    `<span class="code-label">${escapeHTML(label)}</span>`,
    '<button type="button" class="copy-button" data-copy aria-label="Copy code">Copy</button>',
    '</div>',
    html,
    '</div>',
  ].join('');
}
