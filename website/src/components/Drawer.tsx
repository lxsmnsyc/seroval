import type { JSX } from '@solidjs/web';
import { createEffect, onSettled } from 'solid-js';
import { REPOSITORY_URL, menuOpen, setMenuOpen } from '../lib/ui';
import DocsNav from './DocsNav';
import { CloseIcon, GithubIcon, LogoMark } from './Icons';

/**
 * The site links and the docs sidebar on small screens, in a tile that
 * slides from the left. It is a modal dialog, so the browser traps focus,
 * closes it on Esc and returns focus to the menu button.
 */
export default function Drawer(): JSX.Element {
  let dialog: HTMLDialogElement | undefined;

  createEffect(
    () => menuOpen(),
    (open) => {
      if (!dialog) {
        return;
      }
      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    },
  );

  onSettled(() => {
    function onClose(): void {
      setMenuOpen(false);
    }
    // The drawer has no use once the sidebar is back in the page.
    const wide = matchMedia('(min-width: 48rem)');
    function onWide(): void {
      if (wide.matches) {
        setMenuOpen(false);
      }
    }
    dialog?.addEventListener('close', onClose);
    wide.addEventListener('change', onWide);
    return () => {
      dialog?.removeEventListener('close', onClose);
      wide.removeEventListener('change', onWide);
    };
  });

  return (
    <dialog
      class="layer"
      data-layer="drawer"
      id="drawer"
      aria-label="Navigation"
      ref={(element) => {
        dialog = element;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setMenuOpen(false);
        }
      }}
    >
      <div class="drawer">
        <div class="drawer-head">
          <a
            class="wordmark"
            href="/"
            onClick={() => {
              setMenuOpen(false);
            }}
          >
            <LogoMark />
            seroval
          </a>
          <button
            type="button"
            class="icon-button"
            aria-label="Close navigation"
            title="Close navigation"
            onClick={() => {
              setMenuOpen(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
        <nav class="drawer-links" aria-label="Site">
          <a
            href="/playground"
            onClick={() => {
              setMenuOpen(false);
            }}
          >
            Playground
          </a>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            <GithubIcon /> GitHub
          </a>
        </nav>
        <DocsNav />
      </div>
    </dialog>
  );
}
