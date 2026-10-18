import { httpStatus } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { ArrowRightIcon } from '../components/Icons';
import PageMeta from '../components/PageMeta';
import { FIRST_PAGE } from '../lib/docs';

export default function NotFound(): JSX.Element {
  httpStatus(404);
  return (
    <div class="not-found">
      <PageMeta title="Page not found" description="This page does not exist." />
      <p class="not-found-code gradient-text">404</p>
      <h1>Page not found</h1>
      <p>The page you were looking for does not exist or has moved.</p>
      <div class="hero-actions">
        <a class="button button-primary" href={FIRST_PAGE.href}>
          Read the docs <ArrowRightIcon />
        </a>
        <a class="button button-secondary" href="/">
          Home
        </a>
      </div>
    </div>
  );
}
