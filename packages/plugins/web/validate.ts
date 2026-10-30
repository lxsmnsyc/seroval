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

export function expectOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return value;
  }
  return expectString(value);
}

export function expectOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) {
    return value;
  }
  return expectNumber(value);
}

export function expectOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || typeof value === 'boolean') {
    return value;
  }
  throw new Error('Expected a boolean.');
}

export function expectObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected an object.');
  }
  return value as Record<string, unknown>;
}

export function expectHeaders(value: unknown): Headers | undefined {
  if (value === undefined || value instanceof Headers) {
    return value;
  }
  throw new Error('Expected a Headers instance.');
}

// An entry list is copied into fresh pairs, so the constructor never iterates
// an array the input built.
export function expectEntries<T>(
  value: unknown,
  expectValue: (value: unknown) => T,
): [key: string, value: T][] {
  if (!Array.isArray(value)) {
    throw new Error('Expected an array.');
  }
  const entries: [key: string, value: T][] = [];
  for (const entry of value as unknown[]) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error('Expected a key-value pair.');
    }
    entries.push([expectString(entry[0]), expectValue(entry[1])]);
  }
  return entries;
}

// Body values are limited to what the plugins emit, so a body is never
// converted to a string.
export function expectBody(value: unknown): ArrayBuffer | ReadableStream | null {
  if (
    value === null ||
    value === undefined ||
    value instanceof ArrayBuffer ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  ) {
    return value ?? null;
  }
  throw new Error('Expected an ArrayBuffer, a ReadableStream or null.');
}
