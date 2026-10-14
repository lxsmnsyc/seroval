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

export default function ThemeToggle() {
  return (
    <button
      type="button"
      class="theme-toggle"
      aria-label="Toggle color theme"
      onClick={toggleTheme}
    >
      <span class="theme-icon" aria-hidden="true" />
    </button>
  );
}
