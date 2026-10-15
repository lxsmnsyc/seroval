import { FIRST_PAGE } from '../lib/docs';
import { REPOSITORY_URL } from '../lib/ui';
import { LogoMark } from './Icons';

export default function Footer() {
  return (
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <LogoMark />
          <p>
            Released under the MIT License.
            <br />
            Created by{' '}
            <a
              href="https://github.com/lxsmnsyc"
              target="_blank"
              rel="noopener noreferrer"
            >
              lxsmnsyc
            </a>
            .
          </p>
        </div>
        <nav class="footer-links" aria-label="Footer">
          <div>
            <p class="footer-heading">Docs</p>
            <a href={FIRST_PAGE.href}>Introduction</a>
            <a href="/docs/quick-start">Quick start</a>
            <a href="/docs/api">API reference</a>
          </div>
          <div>
            <p class="footer-heading">Project</p>
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/seroval"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm
            </a>
            <a href="/playground">Playground</a>
          </div>
        </nav>
      </div>
    </footer>
  );
}
