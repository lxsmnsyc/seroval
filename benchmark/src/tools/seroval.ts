import { deserialize, serialize } from 'seroval';

export const name = 'seroval';

export function toString(data: unknown): string {
  return serialize(data);
}

export function fromString(str: string): unknown {
  return deserialize(str);
}
