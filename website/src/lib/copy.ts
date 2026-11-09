// An install block holds a command for every package manager, and only the
// chosen one is visible.
function findVisibleCode(button: Element): HTMLPreElement | undefined {
  for (const pre of button.closest('.code-block')?.querySelectorAll('pre') ?? []) {
    if (pre.getClientRects().length > 0) {
      return pre;
    }
  }
  return undefined;
}

/**
 * Copies the code of a rendered code block when its copy button is clicked.
 * Code blocks come from Markdown as plain HTML, so one listener on the
 * document handles all of them.
 */
export default function onCopyClick(event: MouseEvent): void {
  const button =
    event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy]') : null;
  const code = button ? findVisibleCode(button) : undefined;
  if (button && code) {
    void navigator.clipboard.writeText(code.textContent).then(() => {
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 1500);
    });
  }
}
