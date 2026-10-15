import { Show } from 'solid-js';
import { REPOSITORY_URL, menuOpen, setMenuOpen } from '../lib/ui';
import DocsNav from './DocsNav';
import { CloseIcon } from './Icons';

/** The site navigation on small screens. */
export default function Drawer() {
  return (
    <Show when={menuOpen()}>
      <div class="drawer-backdrop" onClick={() => setMenuOpen(false)}>
        <div
          class="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setMenuOpen(false);
            }
          }}
        >
          <button
            type="button"
            class="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <CloseIcon />
          </button>
          <nav class="drawer-links" aria-label="Site">
            <a href="/" onClick={() => setMenuOpen(false)}>
              Home
            </a>
            <a href="/playground" onClick={() => setMenuOpen(false)}>
              Playground
            </a>
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
          <DocsNav />
        </div>
      </div>
    </Show>
  );
}
