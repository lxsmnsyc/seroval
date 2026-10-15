import { parse, stringify } from 'flatted';

export const name = 'flatted';

export function toString(data: unknown): string {
  return stringify(data);
}

export function fromString(str: string): unknown {
  return parse(str);
}
