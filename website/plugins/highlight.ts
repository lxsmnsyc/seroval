import { language as bash } from '@twinkleplop/bash';
import { language as css } from '@twinkleplop/css';
import { language as markup } from '@twinkleplop/html';
import { language as javascript } from '@twinkleplop/javascript';
import { language as json } from '@twinkleplop/json';
import { language as tsx } from '@twinkleplop/tsx';
import { language as typescript } from '@twinkleplop/typescript';

type Highlighter = (code: string) => string;

const LANGUAGES: Record<string, Highlighter | undefined> = {
  js: javascript(),
  ts: typescript(),
  tsx: tsx(),
  json: json(),
  bash: bash(),
  sh: bash(),
  html: markup(),
  css: css(),
};

export function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Highlights code with twinkleplop. The colors come from the site's syntax
 * variables in styles.css, so they follow the light and dark themes.
 */
export function highlight(code: string, lang: string): string {
  const highlighter = LANGUAGES[lang];
  if (!highlighter) {
    return `<pre class="twinkleplop"><code>${escapeHTML(code)}</code></pre>`;
  }
  return highlighter(code);
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
