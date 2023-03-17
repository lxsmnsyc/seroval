import { stringify, parse } from 'o-son';

export const name = 'o-son';

export function toString(data: unknown) {
  return stringify(data);
}

export function fromString(str: string) {
  return parse(str);
}
