import { NJSON } from 'next-json';

export const name = 'next-json';

export function toString(data: unknown) {
  return NJSON.stringify(data);
}

export function fromString(str: string) {
  return NJSON.parse(str);
}
