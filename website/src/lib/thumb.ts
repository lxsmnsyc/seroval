/**
 * The sliding thumb of a pill group. The thumb is one absolutely positioned
 * element that moves to the selected pill with a CSS transition on
 * `transform`, so a new pick mid-way slides from where it is. Size snaps.
 */

const SELECTED =
  ':scope > :is([aria-selected="true"], [aria-checked="true"], [aria-pressed="true"], [tc-selected])';

/** Moves the thumb of a group to its selected pill, adding the thumb first. */
export function placeThumb(group: HTMLElement): void {
  let thumb = group.querySelector<HTMLElement>(':scope > .seg-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'seg-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    group.prepend(thumb);
  }
  const selected = group.querySelector<HTMLElement>(SELECTED);
  if (!selected || selected.offsetWidth === 0) {
    thumb.style.opacity = '0';
    return;
  }
  thumb.style.opacity = '';
  group.style.setProperty('--seg-x', `${selected.offsetLeft}px`);
  group.style.setProperty('--seg-y', `${selected.offsetTop}px`);
  group.style.setProperty('--seg-w', `${selected.offsetWidth}px`);
  group.style.setProperty('--seg-h', `${selected.offsetHeight}px`);
  // The transition starts after the first frame, so nothing slides on first paint.
  if (!group.hasAttribute('data-ready')) {
    requestAnimationFrame(() => {
      group.setAttribute('data-ready', '');
    });
  }
}

/** Places the thumb of every `data-thumb` pill group under `root`. */
export function placeThumbs(root: ParentNode = document): void {
  for (const group of root.querySelectorAll<HTMLElement>('.pills[data-thumb]')) {
    placeThumb(group);
  }
}

/** Keeps every thumb in place when the fonts load or the window resizes. */
export function watchThumbs(): () => void {
  function onResize(): void {
    placeThumbs();
  }
  window.addEventListener('resize', onResize);
  document.fonts.ready.then(onResize).catch(() => undefined);
  return () => {
    window.removeEventListener('resize', onResize);
  };
}
