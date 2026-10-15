import { uneval } from 'devalue';

export const name = 'devalue';

export function toString(data: unknown): string {
  return uneval(data);
}

export function fromString(str: string): unknown {
  // oxlint-disable-next-line no-eval -- The output is JavaScript source, so eval reads it back.
  return (0, eval)(`(${str})`);
}
