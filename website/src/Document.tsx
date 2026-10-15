import { HydrationScript } from '@solidjs/web';
import type { JSX } from '@solidjs/web';

// Sets the color theme before the page paints, so a saved choice does not
// flash the other theme first.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function Document(props: { children?: JSX.Element }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script innerHTML={THEME_SCRIPT} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
