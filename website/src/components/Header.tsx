import type { JSX } from '@solidjs/web';
import { version } from '../../../packages/seroval/package.json';
import { FIRST_PAGE } from '../lib/docs';
import { REPOSITORY_URL, menuOpen, setMenuOpen, setSearchOpen } from '../lib/ui';
import { GitHubIcon, LogoMark, MenuIcon, SearchIcon } from './Icons';
import ThemeToggle from './ThemeToggle';

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
          <span class="brand-name">seroval</span>
          <span class="version-badge">v{version}</span>
        </a>
        <nav class="site-nav" aria-label="Main">
          <a href={FIRST_PAGE.href} class="nav-docs">
            Docs
          </a>
          <a href="/playground">Playground</a>
        </nav>
        <div class="header-actions">
          <button
            type="button"
            class="search-trigger"
            onClick={() => {
              setSearchOpen(true);
            }}
          >
            <SearchIcon />
            <span class="search-placeholder">Search docs</span>
            <kbd>⌘K</kbd>
          </button>
          <a
            class="icon-button github-link"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="seroval on GitHub"
          >
            <GitHubIcon />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
