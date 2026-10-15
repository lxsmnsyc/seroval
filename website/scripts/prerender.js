// Writes every page of the site to a static HTML file in `dist/client`.
// Pages are found by following internal links, starting from the home page.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const ORIGIN = 'http://localhost';
const LINK_PATTERN = /href="(\/[^"#?]*)/g;
const TRAILING_SLASH = /\/$/;

/** @typedef {{ handleRequest: (request: Request) => Promise<Response> }} ServerEntry */

const { handleRequest } = /** @type {ServerEntry} */ (
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The server bundle has no types.
  await import(path.join(DIST, 'server/server.js'))
);

/**
 * @param {string} pathname
 * @returns {Promise<{ status: number, html: string }>}
 */
async function render(pathname) {
  const response = await handleRequest(new Request(ORIGIN + pathname));
  return { status: response.status, html: await response.text() };
}

/**
 * @param {string} pathname
 * @returns {string}
 */
function outputFile(pathname) {
  if (pathname === '/') {
    return 'index.html';
  }
  return `${pathname.slice(1)}.html`;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isPage(pathname) {
  return !path.extname(pathname) || pathname.endsWith('.html');
}

const queue = ['/'];
const seen = new Set(queue);

for (let i = 0; i < queue.length; i++) {
  const pathname = queue[i];
  const { status, html } = await render(pathname);
  if (status !== 200) {
    throw new Error(`${pathname} rendered with status ${status}`);
  }
  const file = path.join(DIST, 'client', outputFile(pathname));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  // oxlint-disable-next-line no-console -- The build log lists every page.
  console.log(`prerendered ${pathname}`);

  for (const [, href] of html.matchAll(LINK_PATTERN)) {
    const next = href.replace(TRAILING_SLASH, '') || '/';
    if (isPage(next) && !seen.has(next)) {
      seen.add(next);
      queue.push(next);
    }
  }
}

// Static hosts serve `404.html` for paths that have no file.
const notFound = await render('/404');
await writeFile(path.join(DIST, 'client', '404.html'), notFound.html);
// oxlint-disable-next-line no-console -- The build log lists every page.
console.log('prerendered 404');

// The static files replace the server bundle.
await rm(path.join(DIST, 'server'), { recursive: true });
