import { HydrationScript } from '@solidjs/web';
import type { JSX } from '@solidjs/web';

export default function Document(props: { children?: JSX.Element }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
