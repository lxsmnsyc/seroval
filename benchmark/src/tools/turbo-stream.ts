import { decode, encode } from 'turbo-stream';

export const name = 'turbo-stream';

export function toString(data: unknown) {
  return encode(data);
}

export function fromString(str: string) {
  return decode(str);
}
