import { NJSON } from 'next-json';

export const name = 'next-json';

export function toString(data: unknown): string {
  return NJSON.stringify(data);
}

export function fromString(str: string): unknown {
  return NJSON.parse(str);
}
