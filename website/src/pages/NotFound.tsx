import { httpStatus } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { ArrowRightIcon, SearchIcon } from '../components/Icons';
import PageMeta from '../components/PageMeta';
import { FIRST_PAGE } from '../lib/docs';
import { setSearchOpen } from '../lib/ui';

export default function NotFound(): JSX.Element {
  httpStatus(404);
  return (
    <div class="tile not-found" data-tone="ink">
      <PageMeta title="Page not found" description="This page does not exist." />
      <p class="not-found-code">404</p>
      <h1>Page not found</h1>
      <p>The link may be old or mistyped. Start from the docs, or search for the page.</p>
      <div class="hero-actions">
        <a class="button" data-variant="primary" href={FIRST_PAGE.href}>
          Read the docs <ArrowRightIcon class="icon-arrow" />
        </a>
        <button
          type="button"
          class="button"
          onClick={() => {
            setSearchOpen(true);
          }}
        >
          <SearchIcon /> Search
        </button>
      </div>
    </div>
  );
}
