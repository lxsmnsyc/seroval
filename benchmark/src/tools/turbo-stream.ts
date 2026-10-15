import { decode, encode } from 'turbo-stream';

export const name = 'turbo-stream';

export function toString(data: unknown): ReadableStream<string> {
  return encode(data);
}

export async function fromString(str: string): Promise<unknown> {
  return decode(str);
}
