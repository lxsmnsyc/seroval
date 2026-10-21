// A plugin's `deserialize` reads nodes that may come from untrusted input, so
// values handed to Web constructors are checked at runtime, not only cast.

export function expectString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string.');
  }
  return value;
}

export function expectNumber(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error('Expected a number.');
  }
  return value;
}

export function expectArrayBuffer(value: unknown): ArrayBuffer {
  if (!(value instanceof ArrayBuffer)) {
    throw new Error('Expected an ArrayBuffer.');
  }
  return value;
}
