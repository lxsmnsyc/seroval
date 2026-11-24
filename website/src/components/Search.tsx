import { useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import type MiniSearch from 'minisearch';
import { For, Show, createEffect, createMemo, createSignal, onSettled } from 'solid-js';
import { PAGES, SECTIONS, getSectionTitle } from '../lib/docs';
import { searchOpen, setSearchOpen } from '../lib/ui';
import { CloseIcon, FileIcon, HashIcon, ReturnIcon, SearchIcon, UpDownIcon } from './Icons';

interface Result {
  id: string;
  slug: string;
  page: string;
  heading: string;
  text: string;
}

/** One row of the dialog: a search result, a recent page or a section start. */
interface Item {
  key: string;
  index: number;
  href: string;
  slug: string;
  title: string;
  path: string;
  section: boolean;
}

interface Group {
  name: string;
  items: Item[];
}

const MAX_RESULTS = 12;
const MAX_RECENT = 5;
const SNIPPET_LENGTH = 110;
const WORDS = /\s+/;
const REGEXP_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const RECENT_KEY = 'seroval:recent-docs';

let loading: Promise<MiniSearch<Result>> | undefined;

// The index and the search library load the first time search opens.
async function loadIndex(): Promise<MiniSearch<Result>> {
  loading ??= Promise.all([import('minisearch'), import('virtual:search-index')]).then(
    ([{ default: MiniSearchClass }, { default: entries }]) => {
      const search = new MiniSearchClass<Result>({
        fields: ['heading', 'page', 'text'],
        storeFields: ['slug', 'page', 'heading', 'text'],
        searchOptions: {
          boost: { heading: 3, page: 2 },
          prefix: true,
          fuzzy: 0.2,
        },
      });
      search.addAll(entries);
      return search;
    },
  );
  return loading;
}

function snippet(text: string, query: string): string {
  const term = query.trim().split(WORDS)[0]?.toLowerCase() ?? '';
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  const start = Math.max(0, at - 30);
  const end = start + SNIPPET_LENGTH;
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function isSection(result: Result): boolean {
  return result.id.includes('#');
}

function toHref(result: Result): string {
  const [, hash] = result.id.split('#');
  return `/docs/${result.slug}${hash ? `#${hash}` : ''}`;
}

/** Wraps the words of the query in `<mark>`. */
function marked(text: string, query: string): JSX.Element[] {
  const words: string[] = [];
  for (const word of query.trim().split(WORDS)) {
    if (word) {
      words.push(word.replace(REGEXP_SPECIALS, '\\$&'));
    }
  }
  if (words.length === 0) {
    return [text];
  }
  // With one capture group, the odd parts are the matches.
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'i'));
  const nodes: JSX.Element[] = [];
  for (let i = 0; i < parts.length; i++) {
    nodes.push(i % 2 === 1 ? <mark>{parts[i]}</mark> : parts[i]);
  }
  return nodes;
}

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    const slugs: string[] = [];
    if (Array.isArray(value)) {
      for (const slug of value) {
        if (typeof slug === 'string') {
          slugs.push(slug);
        }
      }
    }
    return slugs;
  } catch {
    return [];
  }
}

function saveRecent(slug: string): void {
  const next = [slug];
  for (const item of readRecent()) {
    if (item !== slug && next.length < MAX_RECENT) {
      next.push(item);
    }
  }
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked. Recent pages then last for this page only.
  }
}

/** Groups items by section, in the order the groups first appear, and numbers the items. */
function toGroups(entries: { group: string; item: Omit<Item, 'index'> }[]): Group[] {
  const groups = new Map<string, Group>();
  let index = 0;
  for (const entry of entries) {
    let group = groups.get(entry.group);
    if (!group) {
      group = { name: entry.group, items: [] };
      groups.set(entry.group, group);
    }
    group.items.push({ ...entry.item, index });
    index++;
  }
  return [...groups.values()];
}

/** What shows before the reader types: recent pages, else the start of each section. */
function defaultGroups(): Group[] {
  const entries: { group: string; item: Omit<Item, 'index'> }[] = [];
  for (const slug of readRecent()) {
    const page = PAGES.find((item) => item.slug === slug);
    if (page) {
      entries.push({
        group: 'Recent',
        item: {
          key: page.slug,
          href: page.href,
          slug: page.slug,
          title: page.title,
          path: getSectionTitle(page.slug) ?? '',
          section: false,
        },
      });
    }
  }
  if (entries.length === 0) {
    for (const section of SECTIONS) {
      const page = section.pages[0];
      entries.push({
        group: 'Start here',
        item: {
          key: page.slug,
          href: page.href,
          slug: page.slug,
          title: page.title,
          path: section.title,
          section: false,
        },
      });
    }
  }
  return toGroups(entries);
}

/**
 * The docs search dialog. It opens from the header button, from `/` and
 * from Cmd/Ctrl+K. It is a native modal dialog, so the browser traps focus,
 * closes it on Esc and returns focus to the button.
 */
export default function Search(): JSX.Element {
  const navigate = useNavigate();
  const [index, setIndex] = createSignal<MiniSearch<Result>>();
  const [query, setQuery] = createSignal('');
  const [active, setActive] = createSignal(0);
  // Recent pages are read when the dialog opens, since they change as readers navigate.
  const [recent, setRecent] = createSignal<Group[]>([]);

  let dialog: HTMLDialogElement | undefined;
  let input: HTMLInputElement | undefined;
  let list: HTMLUListElement | undefined;

  const results = createMemo((): Result[] => {
    const search = index();
    const trimmed = query().trim();
    if (!(search && trimmed)) {
      return [];
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- MiniSearch types the stored fields as any. They match Result.
    return (search.search(trimmed) as unknown as Result[]).slice(0, MAX_RESULTS);
  });

  const groups = createMemo((): Group[] => {
    if (!query().trim()) {
      return recent();
    }
    const entries: { group: string; item: Omit<Item, 'index'> }[] = [];
    for (const result of results()) {
      entries.push({
        group: getSectionTitle(result.slug) ?? 'Docs',
        item: {
          key: result.id,
          href: toHref(result),
          slug: result.slug,
          title: result.heading,
          path: isSection(result)
            ? `${result.page} · ${snippet(result.text, query())}`
            : snippet(result.text, query()),
          section: isSection(result),
        },
      });
    }
    return toGroups(entries);
  });

  const items = createMemo((): Item[] => {
    const all: Item[] = [];
    for (const group of groups()) {
      all.push(...group.items);
    }
    return all;
  });

  function go(item: Item | undefined): void {
    if (item) {
      saveRecent(item.slug);
      setSearchOpen(false);
      navigate(item.href);
    }
  }

  function move(step: number): void {
    const count = items().length;
    if (count > 0) {
      setActive((current) => (current + step + count) % count);
    }
  }

  function reset(): void {
    setQuery('');
    setActive(0);
    if (input) {
      input.value = '';
    }
  }

  // Open and close the dialog from the signal, and load the index on every way of opening.
  createEffect(
    () => searchOpen(),
    (isOpen) => {
      if (!dialog) {
        return;
      }
      if (isOpen) {
        setRecent(defaultGroups());
        setActive(0);
        if (!dialog.open) {
          dialog.showModal();
        }
        loadIndex()
          .then(setIndex)
          .catch(() => undefined);
      } else if (dialog.open) {
        dialog.close();
        reset();
      }
    },
  );

  // The accent row glides to the selection: one thumb that moves with a transition.
  createEffect(
    () => [active(), items(), searchOpen()] as const,
    ([current, , isOpen]) => {
      if (!(isOpen && list)) {
        return;
      }
      const target = list;
      requestAnimationFrame(() => {
        const option = document.getElementById(`search-option-${current}`);
        const thumb = target.querySelector<HTMLElement>(':scope > .seg-thumb');
        if (!(option && thumb)) {
          if (thumb) {
            thumb.style.opacity = '0';
          }
          return;
        }
        thumb.style.opacity = '';
        target.style.setProperty('--seg-x', `${option.offsetLeft}px`);
        target.style.setProperty('--seg-y', `${option.offsetTop}px`);
        target.style.setProperty('--seg-w', `${option.offsetWidth}px`);
        target.style.setProperty('--seg-h', `${option.offsetHeight}px`);
        option.scrollIntoView({ block: 'nearest' });
        // The transition starts after the first frame, so the thumb does not slide in from the corner.
        requestAnimationFrame(() => {
          target.setAttribute('data-ready', '');
        });
      });
    },
  );

  onSettled(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(!searchOpen());
      } else if (event.key === '/' && !typing && !searchOpen()) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    function onClose(): void {
      setSearchOpen(false);
      reset();
    }
    document.addEventListener('keydown', onKeyDown);
    dialog?.addEventListener('close', onClose);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      dialog?.removeEventListener('close', onClose);
    };
  });

  return (
    <dialog
      class="layer"
      data-layer="search"
      aria-label="Search the docs"
      ref={(element) => {
        dialog = element;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setSearchOpen(false);
        }
      }}
    >
      <div class="search-dialog">
        <div class="search-input">
          <SearchIcon />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-label="Search the docs"
            aria-activedescendant={items().length > 0 ? `search-option-${active()}` : undefined}
            placeholder="Search the docs"
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            ref={(element) => {
              input = element;
            }}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                go(items()[active()]);
              }
            }}
          />
          <button
            type="button"
            class="icon-button"
            data-size="sm"
            aria-label="Close search"
            title="Close search"
            onClick={() => {
              setSearchOpen(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
        <ul
          class="search-results"
          id="search-results"
          role="listbox"
          aria-label="Results"
          ref={(element) => {
            list = element;
          }}
        >
          <li class="seg-thumb" role="presentation" aria-hidden="true" />
          <For each={groups()}>
            {(group) => (
              <>
                <li class="search-group" role="presentation">
                  {group.name}
                </li>
                <For each={group.items}>
                  {(item) => (
                    <li
                      class="search-result"
                      role="option"
                      id={`search-option-${item.index}`}
                      aria-selected={active() === item.index ? 'true' : 'false'}
                      onPointerMove={() => {
                        if (active() !== item.index) {
                          setActive(item.index);
                        }
                      }}
                      onClick={() => {
                        go(item);
                      }}
                    >
                      {item.section ? <HashIcon /> : <FileIcon />}
                      <span class="search-result-body">
                        <span class="search-result-title">{marked(item.title, query())}</span>
                        <span class="search-result-path">{marked(item.path, query())}</span>
                      </span>
                      <span class="kbd" aria-hidden="true">
                        <ReturnIcon />
                      </span>
                    </li>
                  )}
                </For>
              </>
            )}
          </For>
          <Show when={query().trim() && items().length === 0}>
            <li class="search-empty" role="presentation">
              {index() ? `No results for “${query().trim()}”` : 'Loading the index'}
            </li>
          </Show>
        </ul>
        <div class="search-foot" aria-hidden="true">
          <span>
            <UpDownIcon /> Navigate
          </span>
          <span>
            <ReturnIcon /> Open
          </span>
          <span>
            <span class="kbd">Esc</span> Close
          </span>
        </div>
      </div>
    </dialog>
  );
}
