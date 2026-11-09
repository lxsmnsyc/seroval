import { HydrationScript } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { RESTORE_PACKAGE_MANAGER_SCRIPT } from './lib/package-manager';

export default function Document(props: { children?: JSX.Element }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script innerHTML={RESTORE_PACKAGE_MANAGER_SCRIPT} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
