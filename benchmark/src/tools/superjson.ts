import superjson from 'superjson';

export const name = 'superjson';

export function toString(data: unknown): string {
  return superjson.stringify(data);
}

export function fromString(str: string): unknown {
  return superjson.parse(str);
}
