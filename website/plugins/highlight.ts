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
      `<button type="button" class="pm-option" data-pm-option="${manager}" aria-pressed="${manager === 'npm'}">${manager}</button>`,
    );
    panels.push(
      `<div class="pm-command" data-pm-command="${manager}">${highlight(commands[manager], 'bash')}</div>`,
    );
  }
  return [
    '<div class="code-block">',
    '<div class="code-header">',
    `<span class="pm-picker" role="group" aria-label="Package manager">${options.join('')}</span>`,
    '<button type="button" class="copy-button" data-copy aria-label="Copy code">Copy</button>',
    '</div>',
    ...panels,
    '</div>',
  ].join('');
}
