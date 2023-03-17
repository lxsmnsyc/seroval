import superjson from 'superjson';

export const name = 'superjson';

export function toString(data: unknown) {
  return superjson.stringify(data);
}

export function fromString(str: string) {
  return superjson.parse(str);
}