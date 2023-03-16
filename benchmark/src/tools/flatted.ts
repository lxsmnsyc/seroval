import { stringify, parse } from 'flatted';

export const name = 'flatted';

export function toString(data: unknown) {
  return stringify(data);
}

export function fromString(str: string) {
  return parse(str);
}
