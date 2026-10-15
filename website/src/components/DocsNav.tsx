import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import { SECTIONS } from '../lib/docs';
import { setMenuOpen } from '../lib/ui';

/**
 * The docs navigation. The router marks the current page with
 * `aria-current`, which the styles use.
 */
export default function DocsNav(): JSX.Element {
  return (
    <nav class="docs-nav" aria-label="Docs">
      <For each={SECTIONS}>
        {(section) => (
          <div class="docs-nav-section">
            <p class="docs-nav-title">{section.title}</p>
            <For each={section.pages}>
              {(page) => (
                <a
                  href={page.href}
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                >
                  {page.title}
                </a>
              )}
            </For>
          </div>
        )}
      </For>
    </nav>
  );
}
