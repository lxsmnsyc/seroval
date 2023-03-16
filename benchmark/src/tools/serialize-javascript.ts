import serialize from 'serialize-javascript';

export const name = 'serialize-javascript';

export function toString(data: unknown) {
  return serialize(data);
}

export function fromString(str: string) {
  return (0, eval)(str);
}
