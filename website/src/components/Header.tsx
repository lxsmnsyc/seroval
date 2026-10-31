import type { JSX } from '@solidjs/web';
import { FIRST_PAGE } from '../lib/docs';
import { REPOSITORY_URL, SHORT_VERSION, menuOpen, setMenuOpen, setSearchOpen } from '../lib/ui';
import { LogoMark, MenuIcon } from './Icons';

export default function Header(): JSX.Element {
  return (
    <header class="site-header">
      <div class="header-inner">
        <button
          type="button"
          class="icon-button menu-button"
          aria-label="Open navigation"
          aria-expanded={menuOpen() ? 'true' : 'false'}
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
        >
          <MenuIcon />
        </button>
        <a class="brand" href="/">
          <LogoMark />
          seroval
        </a>
        <span class="version-badge">v{SHORT_VERSION}</span>
        <nav class="site-nav" aria-label="Main">
          <a href={FIRST_PAGE.href} class="nav-docs">
            Docs
          </a>
          <a href="/playground">Playground</a>
          <a href="/docs/using-plugins">Plugins</a>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
        <button
          type="button"
          class="search-trigger"
          aria-label="Search docs"
          onClick={() => {
            setSearchOpen(true);
          }}
        >
          ⌘ K
        </button>
      </div>
    </header>
  );
}
