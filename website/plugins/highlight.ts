import { language as bash } from '@twinkleplop/bash';
import { language as css } from '@twinkleplop/css';
import { language as markup } from '@twinkleplop/html';
import { language as javascript } from '@twinkleplop/javascript';
import { language as json } from '@twinkleplop/json';
import { language as tsx } from '@twinkleplop/tsx';
import { language as typescript } from '@twinkleplop/typescript';
import { PACKAGE_MANAGERS, type PackageManager } from '../src/lib/package-manager.ts';

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
 * variables in styles.css, so the palette lives in one place.
 */
export function highlight(code: string, lang: string): string {
  const highlighter = LANGUAGES[lang];
  if (!highlighter) {
    return `<pre class="twinkleplop"><code>${escapeHTML(code)}</code></pre>`;
  }
  return highlighter(code);
}

const FILE_NAME = /[./]/;

function svg(extra: string, paths: string): string {
  return `<svg class="icon"${extra} viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

/** The copy button: a copy icon that swaps to a check, or a cross when copying fails. */
function copyButton(): string {
  return [
    '<button type="button" class="code-copy" data-copy aria-label="Copy"><span class="swap">',
    svg(
      ' data-off',
      '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    ),
    svg(' data-on', '<path d="M20 6 9 17l-5-5"/>'),
    svg(' data-fail', '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>'),
    '</span></button>',
  ].join('');
}

/**
 * Wraps highlighted code in a frame with a label and a copy button. A label
 * that looks like a file name goes on the left, a language on the right.
 */
export function codeFrame(html: string, label: string): string {
  const className = FILE_NAME.test(label) ? 'code-block-name' : 'code-lang';
  return [
    '<div class="code-block">',
    // The header wrapper keeps the label and the button out of the search index.
    `<div class="code-header"><span class="${className}">${escapeHTML(label)}</span>${copyButton()}</div>`,
    html,
    '</div>',
  ].join('');
}

/**
 * Wraps an install command in a frame with a package manager picker and a
 * copy button. It holds the command for every manager, and the stylesheet
 * shows the chosen one.
 */
export function installFrame(commands: Record<PackageManager, string>): string {
  const options: string[] = [];
  const panels: string[] = [];
  for (const manager of PACKAGE_MANAGERS) {
    options.push(
      `<button type="button" class="pill" data-pm-option="${manager}" aria-pressed="${manager === 'npm'}">${manager}</button>`,
    );
    panels.push(`<div data-pm-command="${manager}">${highlight(commands[manager], 'bash')}</div>`);
  }
  return [
    '<div class="code-block install-block">',
    `<div class="code-header"><span class="pills" data-thumb role="group" aria-label="Package manager">${options.join('')}</span>${copyButton()}</div>`,
    ...panels,
    '</div>',
  ].join('');
}
