export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Applies the reader's pick before the first paint, so the page does not
 * flash the wrong theme. It runs as an inline script in the head. Until the
 * reader picks, the stylesheet follows `prefers-color-scheme`.
 */
export const RESTORE_THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

/** Returns the theme in effect: the pick, or else the system's. */
export function getTheme(): Theme {
  const pick = document.documentElement.dataset.theme;
  if (pick === 'light' || pick === 'dark') {
    return pick;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Saves the reader's pick and applies it. */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked. The pick then lasts for this page only.
  }
}
