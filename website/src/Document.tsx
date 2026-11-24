import { HydrationScript } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { RESTORE_PACKAGE_MANAGER_SCRIPT } from './lib/package-manager';
import { RESTORE_THEME_SCRIPT } from './lib/theme';

export default function Document(props: { children?: JSX.Element }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="preload"
          href="/fonts/bricolage-grotesque.woff2"
          as="font"
          type="font/woff2"
          crossorigin="anonymous"
        />
        <script innerHTML={RESTORE_THEME_SCRIPT} />
        <script innerHTML={RESTORE_PACKAGE_MANAGER_SCRIPT} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
