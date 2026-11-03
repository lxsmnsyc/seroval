import { describe, expect, it } from 'vitest';
import { LiveStream, createLiveStream, isLiveStream } from '../src/core/live-stream';
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

  it('recognizes a genuine LiveStream', () => {
    const { stream } = createLiveStream();
    expect(isLiveStream(stream)).toBe(true);
    expect(isStream(stream)).toBe(true);
  });

  it('recognizes a LiveStream made with its public constructor', () => {
    const stream = new LiveStream();
    expect(isLiveStream(stream)).toBe(true);
    expect(isStream(stream)).toBe(true);
  });

  it('rejects a POJO forging the LiveStream marker', () => {
    const forged = {
      __SEROVAL_STREAM__: 2,
      consume: () => undefined,
      on: () => () => undefined,
      pump: () => () => undefined,
    };
    expect(isLiveStream(forged)).toBe(false);
    expect(isStream(forged)).toBe(false);
  });

  it('rejects an object made from the LiveStream prototype', () => {
    const forged: unknown = Object.create(LiveStream.prototype);
    expect(isLiveStream(forged)).toBe(false);
    expect(isStream(forged)).toBe(false);
  });

  it('recognizes a LiveStream behind a Proxy', () => {
    const { stream } = createLiveStream();
    const proxied: unknown = new Proxy(stream, {});
    expect(isLiveStream(proxied)).toBe(true);
    expect(isStream(proxied)).toBe(true);
  });

  it('recognizes a genuine Sequence', () => {
    expect(isSequence(createSequence([1, 2], -1, 1))).toBe(true);
  });

  it('rejects a POJO forging the Sequence marker', () => {
    const forged = { __SEROVAL_SEQUENCE__: true, v: [1], t: -1, d: 0 };
    expect(isSequence(forged)).toBe(false);
  });
});
