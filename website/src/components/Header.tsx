import { useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createSignal, onSettled } from 'solid-js';
import { FIRST_PAGE, getSectionTitle } from '../lib/docs';
import { type Theme, getTheme, setTheme } from '../lib/theme';
import { REPOSITORY_URL, VERSION, menuOpen, setMenuOpen, setSearchOpen } from '../lib/ui';
import { GithubIcon, LogoMark, MenuIcon, MoonIcon, SearchIcon, SunIcon } from './Icons';

const DOCS_PREFIX = '/docs/';
const PLUGINS_SECTION = 'Plugins';

/** The header's theme switch. It shows the theme it switches to. */
function ThemeToggle(): JSX.Element {
  const [theme, setCurrent] = createSignal<Theme>();

  onSettled(() => {
    setCurrent(getTheme());
    // Until the reader picks, the theme follows the system.
    const query = matchMedia('(prefers-color-scheme: dark)');
    function onChange(): void {
      setCurrent(getTheme());
    }
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  });

  function label(): string {
    const current = theme();
    if (!current) {
      return 'Switch theme';
    }
    return current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }

  return (
    <button
      type="button"
      class="pill icon-pill theme-toggle"
      aria-label={label()}
      title={label()}
      onClick={() => {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        setTheme(next);
        setCurrent(next);
      }}
    >
      <SunIcon class="icon-sun" />
      <MoonIcon class="icon-moon" />
    </button>
  );
}

/** The search button: it opens the dialog, as do `/` and Cmd/Ctrl+K. */
function SearchTrigger(): JSX.Element {
  const [mac, setMac] = createSignal(false);

  onSettled(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  });

  return (
    <button
      type="button"
      class="search-trigger"
      aria-label="Search docs"
      title="Search docs"
      aria-keyshortcuts="Control+K Meta+K /"
      onClick={() => {
        setSearchOpen(true);
      }}
    >
      <SearchIcon />
      <span>Search docs</span>
      <kbd class="kbd">{mac() ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  );
}

export default function Header(): JSX.Element {
  const location = useLocation();

  // The plugin pages are part of the docs, but have their own link.
  function current(link: 'docs' | 'plugins' | 'playground'): 'page' | undefined {
    const path = location.pathname.replace(/\/$/, '');
    if (link === 'playground') {
      return path === '/playground' ? 'page' : undefined;
    }
    if (!path.startsWith(DOCS_PREFIX)) {
      return undefined;
    }
    const isPlugins = getSectionTitle(path.slice(DOCS_PREFIX.length)) === PLUGINS_SECTION;
    return isPlugins === (link === 'plugins') ? 'page' : undefined;
  }

  return (
    <header class="site-header">
      <div class="site-header-inner">
        <button
          type="button"
          class="icon-button menu-button"
          aria-label="Open navigation"
          title="Open navigation"
          aria-expanded={menuOpen() ? 'true' : 'false'}
          aria-controls="drawer"
          onClick={() => {
            setMenuOpen(true);
          }}
        >
          <MenuIcon />
        </button>
        <a class="wordmark" href="/">
          <LogoMark />
          seroval
          <span class="wordmark-version">v{VERSION}</span>
        </a>
        <div class="site-header-slot">
          <SearchTrigger />
        </div>
        <nav class="site-nav pills" aria-label="Main">
          <a class="pill" href={FIRST_PAGE.href} aria-current={current('docs')}>
            Docs
          </a>
          <a class="pill" href="/playground" aria-current={current('playground')}>
            Playground
          </a>
          <a class="pill" href="/docs/using-plugins" aria-current={current('plugins')}>
            Plugins
          </a>
          <a
            class="pill icon-pill"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <GithubIcon />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
