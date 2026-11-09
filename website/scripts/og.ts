/**
 * Renders `scripts/og.html` to `public/og.png`, the 1200 by 630 image that
 * link previews show. Run it again after changing the page.
 *
 * Usage: `pnpm og`. Set `CHROME` to use another Chrome binary.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(HERE, '..', 'public', 'og.png');

const profile = mkdtempSync(path.join(tmpdir(), 'og-chrome-'));
try {
  execFileSync(CHROME, [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    // Wait for the web fonts before the screenshot.
    '--virtual-time-budget=2000',
    `--screenshot=${OUTPUT}`,
    pathToFileURL(path.join(HERE, 'og.html')).href,
  ]);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
process.stdout.write(`Wrote ${OUTPUT}\n`);
