import { serialize, deserialize, ServerValue } from 'seroval';

export const name = 'seroval';

export function toString(data: unknown) {
  return serialize(data as ServerValue);
}

export function fromString(str: string) {
  return deserialize(str);
}
