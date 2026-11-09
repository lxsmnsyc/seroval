/**
 * The package manager picker on install commands. The choice lives in the
 * `data-pm` attribute of the root element and in local storage, and the
 * stylesheet shows each install command for the chosen manager. Install
 * commands come both from Markdown, as plain HTML, and from components, so
 * both render the same markup and one listener on the document handles them.
 */

export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const STORAGE_KEY = 'seroval:package-manager';

const ADD_COMMANDS: Record<PackageManager, string> = {
  npm: 'npm install',
  pnpm: 'pnpm add',
  yarn: 'yarn add',
  bun: 'bun add',
};

const NPM_INSTALL = /^npm (?:install|i)(?= )/;

/**
 * Returns the arguments of a one-line `npm install` command, such as
 * `seroval @seroval/transport`, or undefined for any other code.
 */
export function parseNpmInstall(code: string): string | undefined {
  const line = code.trim();
  if (line.includes('\n') || !NPM_INSTALL.test(line)) {
    return undefined;
  }
  return line.replace(NPM_INSTALL, '').trim();
}

/** Builds the install command for `args` with each package manager. */
export function createInstallCommands(args: string): Record<PackageManager, string> {
  return {
    npm: `${ADD_COMMANDS.npm} ${args}`,
    pnpm: `${ADD_COMMANDS.pnpm} ${args}`,
    yarn: `${ADD_COMMANDS.yarn} ${args}`,
    bun: `${ADD_COMMANDS.bun} ${args}`,
  };
}

function isPackageManager(value: string | null | undefined): value is PackageManager {
  return value != null && (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

/**
 * Applies the stored choice before the first paint, so the page does not
 * flash the npm commands. It runs as an inline script in the head.
 */
export const RESTORE_PACKAGE_MANAGER_SCRIPT = `try{var m=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(${JSON.stringify(PACKAGE_MANAGERS)}.indexOf(m)>=0)document.documentElement.dataset.pm=m}catch(e){}`;

/** Returns the chosen package manager. */
export function getPackageManager(): PackageManager {
  const value = document.documentElement.dataset.pm;
  return isPackageManager(value) ? value : 'npm';
}

/**
 * Marks the picker buttons of the chosen manager as pressed. Pages call it
 * after they render, because prerendered buttons always mark npm.
 */
export function syncPackageManagerButtons(): void {
  const manager = getPackageManager();
  for (const button of document.querySelectorAll<HTMLElement>('[data-pm-option]')) {
    button.setAttribute('aria-pressed', String(button.dataset.pmOption === manager));
  }
}

/** Switches every install command on the page when a picker button is clicked. */
export function onPackageManagerClick(event: MouseEvent): void {
  const button =
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-pm-option]') : null;
  const manager = button?.dataset.pmOption;
  if (!isPackageManager(manager)) {
    return;
  }
  document.documentElement.dataset.pm = manager;
  try {
    localStorage.setItem(STORAGE_KEY, manager);
  } catch {
    // Storage can be blocked. The choice then lasts for this page only.
  }
  syncPackageManagerButtons();
}
