import { serialize, deserialize } from 'seroval';

export const name = 'seroval';

export function toString(data: unknown) {
  return serialize(data);
}

export function fromString(str: string) {
  return deserialize(str);
}
