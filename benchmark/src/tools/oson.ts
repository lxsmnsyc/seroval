import { parse, stringify } from 'o-son';

export const name = 'o-son';

export function toString(data: unknown): string {
  return stringify(data);
}

export function fromString(str: string): unknown {
  return parse(str);
}
