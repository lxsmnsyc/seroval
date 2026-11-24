import type { JSX } from '@solidjs/web';
import { For, onSettled } from 'solid-js';
import { SECTIONS } from '../lib/docs';
import { setMenuOpen } from '../lib/ui';

/** Scrolls the sidebar so the current page is in the middle of it. */
function revealCurrent(nav: HTMLElement): void {
  const link = nav.querySelector<HTMLElement>('[aria-current="page"]');
  const container = nav.closest<HTMLElement>('.docs-sidebar, .drawer');
  if (link && container) {
    const offset = link.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTop += offset - container.clientHeight / 2;
  }
}

/**
 * The docs navigation. The router marks the current page with
 * `aria-current`, which the styles use.
 */
export default function DocsNav(): JSX.Element {
  let nav: HTMLElement | undefined;

  onSettled(() => {
    const frame = requestAnimationFrame(() => {
      if (nav) {
        revealCurrent(nav);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  });

  return (
    <nav
      aria-label="Docs"
      ref={(element) => {
        nav = element;
      }}
    >
      <For each={SECTIONS}>
        {(section) => (
          <div class="sidebar-group">
            <p class="sidebar-label">{section.title}</p>
            <ul class="sidebar-list">
              <For each={section.pages}>
                {(page) => (
                  <li>
                    <a
                      href={page.href}
                      onClick={() => {
                        setMenuOpen(false);
                      }}
                    >
                      {page.title}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>
    </nav>
  );
}
