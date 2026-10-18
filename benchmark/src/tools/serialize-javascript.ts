import serialize from 'serialize-javascript';

export const name = 'serialize-javascript';

export function toString(data: unknown): string {
  return serialize(data);
}

export function fromString(str: string): unknown {
  // oxlint-disable-next-line no-eval -- The output is JavaScript source, so eval reads it back.
  return (0, eval)(str);
}
