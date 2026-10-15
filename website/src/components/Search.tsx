import { useNavigate } from '@solidjs/router';
import type MiniSearch from 'minisearch';
import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import {
  Command,
  CommandInput,
  CommandOption,
  CommandOptions,
} from 'terracotta/command';
import {
  CommandBar,
  CommandBarDescription,
  CommandBarOverlay,
  CommandBarPanel,
  CommandBarTitle,
} from 'terracotta/command-bar';
import { searchOpen, setSearchOpen } from '../lib/ui';
import { FileIcon, HashIcon, ReturnIcon, SearchIcon } from './Icons';

interface Result {
  id: string;
  slug: string;
  page: string;
  heading: string;
  text: string;
}

const MAX_RESULTS = 12;
const SNIPPET_LENGTH = 110;
const WORDS = /\s+/;

let loading: Promise<MiniSearch<Result>> | undefined;

// The index and the search library load the first time search opens.
function loadIndex(): Promise<MiniSearch<Result>> {
  loading ??= Promise.all([
    import('minisearch'),
    import('virtual:search-index'),
  ]).then(([{ default: MiniSearchClass }, { default: entries }]) => {
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
  });
  return loading;
}

function snippet(text: string, query: string): string {
  const term = query.trim().split(WORDS)[0]?.toLowerCase() ?? '';
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  const start = Math.max(0, at - 30);
  const end = start + SNIPPET_LENGTH;
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end) +
    (end < text.length ? '…' : '')
  );
}

function toHref(result: Result): string {
  const [, hash] = result.id.split('#');
  return `/docs/${result.slug}${hash ? `#${hash}` : ''}`;
}

function isSection(result: Result): boolean {
  return result.id.includes('#');
}

/**
 * The docs search dialog. Cmd/Ctrl+K (handled by `CommandBar`) and `/` open
 * it from anywhere.
 */
export default function Search() {
  const navigate = useNavigate();
  const [index, setIndex] = createSignal<MiniSearch<Result>>();
  const [query, setQuery] = createSignal('');

  const results = createMemo(() => {
    const search = index();
    const trimmed = query().trim();
    if (!(search && trimmed)) {
      return [];
    }
    return (search.search(trimmed) as unknown as Result[]).slice(
      0,
      MAX_RESULTS,
    );
  });

  function go(result: Result | undefined) {
    if (result) {
      setSearchOpen(false);
      setQuery('');
      navigate(toHref(result));
    }
  }

  function open() {
    setSearchOpen(true);
    loadIndex().then(setIndex);
  }

  onSettled(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA';
      if (event.key === '/' && !typing) {
        event.preventDefault();
        open();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  return (
    <CommandBar
      class="search"
      isOpen={searchOpen()}
      onOpen={open}
      onClose={() => setSearchOpen(false)}
    >
      <CommandBarOverlay class="search-overlay" />
      <CommandBarPanel class="search-panel">
        <CommandBarTitle class="visually-hidden">Search the docs</CommandBarTitle>
        <CommandBarDescription class="visually-hidden">
          Type to search, use the arrow keys to move, and press Enter to open
          a result.
        </CommandBarDescription>
        <Command<Result>
          class="search-command"
          defaultValue={undefined as unknown as Result}
          by={(a, b) => a.id === b.id}
          // Results come from the index already filtered.
          matchBy={() => true}
          onChange={go}
        >
          <div class="search-input-row">
            <SearchIcon />
            <CommandInput
              class="search-input"
              placeholder="Search the docs"
              onInput={event => setQuery(event.currentTarget.value)}
              onKeyDown={event => {
                // Results arrive after the query changes, so the first one
                // may not be active yet. Enter then opens it.
                if (
                  event.key === 'Enter' &&
                  !event.currentTarget.getAttribute('aria-activedescendant')
                ) {
                  go(results()[0]);
                }
              }}
            />
            <kbd>Esc</kbd>
          </div>
          <CommandOptions class="search-results">
            {() => (
                <>
                  <For each={results()}>
                    {result => (
                      <CommandOption class="search-result" value={result}>
                        {isSection(result) ? <HashIcon /> : <FileIcon />}
                        <span class="search-result-body">
                          <span class="search-result-title">
                            {result.heading}
                            <Show when={isSection(result)}>
                              <span class="search-result-page">
                                {result.page}
                              </span>
                            </Show>
                          </span>
                          <span class="search-result-text">
                            {snippet(result.text, query())}
                          </span>
                        </span>
                        <ReturnIcon class="search-result-enter" />
                      </CommandOption>
                    )}
                  </For>
                  <Show when={results().length === 0}>
                    <li class="search-empty" role="presentation">
                      {query().trim()
                        ? `No results for “${query()}”`
                        : 'Search guides, APIs and options.'}
                    </li>
                  </Show>
                </>
            )}
          </CommandOptions>
        </Command>
      </CommandBarPanel>
    </CommandBar>
  );
}
