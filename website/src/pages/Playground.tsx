import { clientOnly } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import PageMeta from '../components/PageMeta';

// The editor runs the reader's code, so it only renders in the browser.
const PlaygroundEditor = clientOnly(async () => import('../components/PlaygroundEditor'));

export default function Playground(): JSX.Element {
  return (
    <div class="playground-page">
      <PageMeta
        title="Playground"
        description="Try seroval in the browser and compare its output modes."
      />
      <h1 class="visually-hidden">Playground</h1>
      <PlaygroundEditor fallback={<div class="playground-loading">Loading the editor</div>} />
    </div>
  );
}
