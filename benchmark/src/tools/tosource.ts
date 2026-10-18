import tosource from 'tosource';

export const name = 'tosource';

export function toString(data: unknown): string {
  return tosource(data);
}

export function fromString(str: string): unknown {
  // oxlint-disable-next-line no-eval -- The output is JavaScript source, so eval reads it back.
  return (0, eval)(str);
}
