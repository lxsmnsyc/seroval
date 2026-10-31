import type { JSX } from '@solidjs/web';
import { REPOSITORY_URL } from '../lib/ui';

export default function Footer(): JSX.Element {
  return (
    <footer class="site-footer">
      <span>seroval — MIT</span>
      <span>
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        {' · '}
        <a href="https://www.npmjs.com/package/seroval" target="_blank" rel="noopener noreferrer">
          npm
        </a>
      </span>
    </footer>
  );
}
