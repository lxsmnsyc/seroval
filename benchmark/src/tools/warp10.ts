// @ts-ignore
import { serialize } from 'warp10';

export const name = 'warp10';

const options = { safe: true };

export function toString(data: unknown) {
  return serialize(data, options);
}

export function fromString(str: string) {
  return (0, eval)(str);
}
