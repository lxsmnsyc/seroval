import tosource from 'tosource';

export const name = 'tosource';

export function toString(data: unknown) {
  return tosource(data);
}

export function fromString(str: string) {
  return (0, eval)(str);
}