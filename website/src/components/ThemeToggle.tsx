import { MoonIcon, SunIcon } from './Icons';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  const saved = document.documentElement.dataset.theme;
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// Switches between light and dark and remembers the choice.
function toggleTheme() {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Storage can be unavailable, for example in a private window.
  }
}

// Both icons are rendered and CSS shows the one for the current theme, so
// the server-rendered markup does not depend on the reader's theme.
export default function ThemeToggle() {
  return (
    <button
      type="button"
      class="icon-button theme-toggle"
      aria-label="Toggle color theme"
      onClick={toggleTheme}
    >
      <SunIcon class="theme-icon-light" />
      <MoonIcon class="theme-icon-dark" />
    </button>
  );
}
