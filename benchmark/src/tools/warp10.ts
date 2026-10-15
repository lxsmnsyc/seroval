import { serialize } from 'warp10';

export const name = 'warp10';

const options = { safe: true };

export function toString(data: unknown): string {
  return serialize(data, options);
}

export function fromString(str: string): unknown {
  // oxlint-disable-next-line no-eval -- The output is JavaScript source, so eval reads it back.
  return (0, eval)(str);
}
