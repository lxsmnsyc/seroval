import type { JSX } from '@solidjs/web';
import { CheckIcon, CircleXIcon, CopyIcon } from './Icons';

/**
 * A round copy button. The document's click handler copies `text`, swaps the
 * icon to a check and changes the label to "Copied" for a moment.
 */
export default function CopyButton(props: { text: string }): JSX.Element {
  return (
    <button type="button" class="code-copy" data-copy data-copy-text={props.text} aria-label="Copy">
      <span class="swap">
        <span data-off>
          <CopyIcon />
        </span>
        <span data-on>
          <CheckIcon />
        </span>
        <span data-fail>
          <CircleXIcon />
        </span>
      </span>
    </button>
  );
}
