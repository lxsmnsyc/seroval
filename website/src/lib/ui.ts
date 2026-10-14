import { createSignal } from 'solid-js';

// State shared by the header and the pages. Each page load renders one
// tree, so module-level signals are enough here.

/** Whether the docs navigation drawer is open on small screens. */
export const [menuOpen, setMenuOpen] = createSignal(false);

/** Whether the search dialog is open. */
export const [searchOpen, setSearchOpen] = createSignal(false);

export const SITE_URL = 'https://seroval.vercel.app';
export const REPOSITORY_URL = 'https://github.com/lxsmnsyc/seroval';
