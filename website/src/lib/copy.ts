/**
 * Copies the code of a rendered code block when its copy button is clicked.
 * Code blocks come from Markdown as plain HTML, so one listener on the
 * document handles all of them.
 */
export function onCopyClick(event: MouseEvent) {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
    '[data-copy]',
  );
  const code = button?.closest('.code-block')?.querySelector('pre');
  if (button && code) {
    navigator.clipboard.writeText(code.textContent ?? '').then(() => {
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 1500);
    });
  }
}
