import { describe, expect, it } from 'vitest';
import { createSequence, isSequence } from '../src/core/sequence';
import { createStream, isStream } from '../src/core/stream';

describe('Stream/Sequence identity', () => {
  it('recognizes a genuine Stream', () => {
    expect(isStream(createStream())).toBe(true);
  });

  it('rejects a POJO forging the Stream marker', () => {
    const forged = {
      __SEROVAL_STREAM__: true,
      on: () => () => undefined,
      next: () => undefined,
      throw: () => undefined,
      return: () => undefined,
    };
    expect(isStream(forged)).toBe(false);
  });

  it('recognizes a genuine Sequence', () => {
    expect(isSequence(createSequence([1, 2], -1, 1))).toBe(true);
  });

  it('rejects a POJO forging the Sequence marker', () => {
    const forged = { __SEROVAL_SEQUENCE__: true, v: [1], t: -1, d: 0 };
    expect(isSequence(forged)).toBe(false);
  });
});
