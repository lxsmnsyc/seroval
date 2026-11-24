import type { JSX } from '@solidjs/web';
import { REPOSITORY_URL } from '../lib/ui';

export default function Footer(): JSX.Element {
  return (
    <footer class="site-footer">
      <span>MIT license · Alexis Munsayac</span>
      <nav aria-label="Footer">
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <a href="https://www.npmjs.com/package/seroval" target="_blank" rel="noopener noreferrer">
          npm
        </a>
        <a href={`${REPOSITORY_URL}/releases`} target="_blank" rel="noopener noreferrer">
          Changelog
        </a>
      </nav>
    </footer>
  );
}
