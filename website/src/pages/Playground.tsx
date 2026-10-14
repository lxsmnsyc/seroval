import { clientOnly } from '@solidjs/web';
import PageMeta from '../components/PageMeta';

// The editor runs the reader's code, so it only renders in the browser.
const PlaygroundEditor = clientOnly(
  () => import('../components/PlaygroundEditor'),
);

export default function Playground() {
  return (
    <div class="playground-page">
      <PageMeta
        title="Playground"
        description="Try seroval in the browser and compare its output modes."
      />
      <header class="page-header">
        <h1>Playground</h1>
        <p>
          Write code that returns a value, pick an output mode, and see what
          seroval produces. Your code runs only in this browser.
        </p>
      </header>
      <PlaygroundEditor
        fallback={<div class="playground-loading">Loading the editor…</div>}
      />
    </div>
  );
}
