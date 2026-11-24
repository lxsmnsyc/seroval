import { describe, expect, it } from 'vitest';
import type { SerovalJSON } from '../src';
import { fromCrossJSON, fromJSON, toCrossJSON, toJSON } from '../src';

// Drop the serialized own properties (`stack`, `name`, `errors`) so the
// decoded error keeps only what its constructor gave it.
function stripProperties(node: SerovalJSON['t']): SerovalJSON['t'] {
  const copy: SerovalJSON['t'] & { p?: unknown } = { ...node };
  delete copy.p;
  return copy;
}

function makeErrors(): Error[] {
  return [new Error('a'), new TypeError('b'), new AggregateError([], 'c')];
}

describe('decoded error stack capture', () => {
  it('does not capture a stack trace when constructing errors in fromJSON', () => {
    const limit = Error.stackTraceLimit;
    for (const error of makeErrors()) {
      const json = toJSON(error);
      const back = fromJSON<Error>({ ...json, t: stripProperties(json.t) });
      expect(back).toBeInstanceOf(error.constructor);
      expect(back.message).toBe(error.message);
      expect(back.stack ?? '').not.toMatch(/\n\s+at /);
    }
    expect(Error.stackTraceLimit).toBe(limit);
  });

  it('does not capture a stack trace when constructing errors in fromCrossJSON', () => {
    const limit = Error.stackTraceLimit;
    for (const error of makeErrors()) {
      const node = stripProperties(toCrossJSON(error));
      const back = fromCrossJSON<Error>(node, { refs: new Map() });
      expect(back).toBeInstanceOf(error.constructor);
      expect(back.message).toBe(error.message);
      expect(back.stack ?? '').not.toMatch(/\n\s+at /);
    }
    expect(Error.stackTraceLimit).toBe(limit);
  });

  it('keeps the serialized stack', () => {
    const error = new Error('a');
    error.stack = 'Error: a\n    at somewhere';
    const back = fromJSON<Error>(toJSON(error));
    expect(back.stack).toBe('Error: a\n    at somewhere');
  });
});
