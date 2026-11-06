import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { crossSerialize, fromJSON, serialize, toJSON } from '../src';

const MARKER = '__serovalMarker';

// Values a parsed JSON body can put in `message` when it is copied onto an
// Error. Each string element tries to close the surrounding literal.
const MESSAGES: unknown[] = [
  [`"+(globalThis.${MARKER}=1)+"`],
  [1, `+(globalThis.${MARKER}=1)+'<'+`, 2, ...Array.from({ length: 61 }, () => 0)],
  { toString: () => 'object' },
  123,
  null,
];

function runsMarker(source: string): boolean {
  const context: Record<string, unknown> = { $R: [] };
  try {
    runInNewContext(source, context);
  } catch {
    // A syntax error is still a broken literal, checked separately.
  }
  return context[MARKER] !== undefined;
}

function createError(message: unknown): Error {
  return Object.assign(new Error(), { message });
}

describe('non-string Error message', () => {
  it.each(MESSAGES)('keeps %j inside the string literal', (message) => {
    for (const source of [serialize(createError(message)), crossSerialize(createError(message))]) {
      expect(runsMarker(source)).toBe(false);
    }
  });

  it.each(MESSAGES)('round-trips %j as its string form', (message) => {
    const expected = String(message);
    const back = runInNewContext(serialize(createError(message))) as Error;
    expect(back.message).toBe(expected);
    expect(fromJSON<Error>(toJSON(createError(message))).message).toBe(expected);
  });

  it('reads a changing toString only once', () => {
    let calls = 0;
    const message = {
      toString(): string {
        calls++;
        return calls === 1 ? 'first' : `"+(globalThis.${MARKER}=1)+"`;
      },
    };
    const source = serialize(createError(message));
    expect(runsMarker(source)).toBe(false);
  });

  it('keeps a non-string Symbol.toStringTag inside the string literal', () => {
    const value = {
      [Symbol.toStringTag]: [1, `+(globalThis.${MARKER}=1)+'<'+`, 2, ...Array.from({ length: 61 }, () => 0)],
    };
    expect(runsMarker(serialize(value))).toBe(false);
  });
});
