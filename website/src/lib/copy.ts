// An install block holds a command for every package manager, and only the
// chosen one is visible.
function findVisibleCode(button: Element): HTMLElement | undefined {
  for (const pre of button.closest('.code-block')?.querySelectorAll('pre') ?? []) {
    if (pre.getClientRects().length > 0) {
      return pre;
    }
  }
  return undefined;
}

const RESET_AFTER = 1500;
const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
let announcer: HTMLElement | undefined;

/** Says the result of a copy to screen readers, through one polite live region. */
function announce(message: string): void {
  if (!announcer) {
    announcer = document.createElement('span');
    announcer.className = 'visually-hidden';
    announcer.setAttribute('aria-live', 'polite');
    document.body.append(announcer);
  }
  const region = announcer;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/** Shakes a control once to flag an error. Skipped under reduced motion. */
export function shake(element: HTMLElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  element.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 240, easing: 'ease-out' },
  );
}

/**
 * Swaps a copy button's icon to a check (or a cross on failure) for 1.5
 * seconds and changes its label to match. A second click restarts the timer.
 */
export function showCopyResult(button: HTMLElement, ok: boolean): void {
  const label = button.dataset.label ?? button.getAttribute('aria-label') ?? 'Copy';
  button.dataset.label = label;
  const message = ok ? 'Copied' : 'Copy failed';
  button.dataset.state = ok ? 'done' : 'failed';
  button.setAttribute('aria-label', message);
  announce(message);
  if (!ok) {
    shake(button);
  }
  clearTimeout(timers.get(button));
  timers.set(
    button,
    setTimeout(() => {
      button.dataset.state = '';
      button.setAttribute('aria-label', label);
    }, RESET_AFTER),
  );
}

/** Copies text and shows the result on the button that asked. */
export function copyText(button: HTMLElement, text: string): void {
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- The clipboard is missing outside secure contexts.
  if (!navigator.clipboard) {
    showCopyResult(button, false);
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => {
      showCopyResult(button, true);
    },
    () => {
      showCopyResult(button, false);
    },
  );
}

/**
 * Copies the code of a rendered code block when its copy button is clicked.
 * Code blocks come from Markdown as plain HTML, so one listener on the
 * document handles all of them. A button with `data-copy-text` copies that.
 */
export default function onCopyClick(event: MouseEvent): void {
  const button =
    event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy]') : null;
  if (!button) {
    return;
  }
  const code = button.dataset.copyText ?? findVisibleCode(button)?.textContent;
  if (code) {
    copyText(button, code);
  }
}
