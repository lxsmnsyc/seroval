import { describe, expect, it } from 'vitest';
import type { Message } from '../src/frame';
import { SerovalTransportError, createFrameDecoder, encodeFrame } from '../src/frame';

function encode(messages: Message[]): Uint8Array {
  const pieces: Uint8Array[] = [];
  let length = 0;
  for (const message of messages) {
    for (const piece of encodeFrame(message)) {
      pieces.push(piece);
      length += piece.length;
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    bytes.set(piece, offset);
    offset += piece.length;
  }
  return bytes;
}

function decode(chunks: Uint8Array[], maxFrameSize?: number): unknown[] {
  const messages: unknown[] = [];
  const decoder = createFrameDecoder({
    maxFrameSize,
    onMessage: (message) => void messages.push(message),
  });
  for (const chunk of chunks) {
    decoder.push(chunk);
  }
  decoder.end();
  return messages;
}

const MESSAGES: Message[] = [
  [0, 'a', { t: 1, s: 'é' }],
  [1, 'a'],
  [2, 'b'],
];

describe('frames', () => {
  it('decodes many frames from one chunk', () => {
    expect(decode([encode(MESSAGES)])).toEqual(MESSAGES);
  });

  it('decodes frames split into single bytes', () => {
    const bytes = encode(MESSAGES);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i++) {
      chunks.push(bytes.subarray(i, i + 1));
    }
    expect(decode(chunks)).toEqual(MESSAGES);
  });

  it('decodes nothing from no bytes', () => {
    expect(decode([new Uint8Array(0)])).toEqual([]);
  });

  it('throws when the bytes end inside a frame', () => {
    const bytes = encode(MESSAGES);
    expect(() => decode([bytes.subarray(0, bytes.length - 1)])).toThrow(SerovalTransportError);
    expect(() => decode([bytes.subarray(0, 5)])).toThrow(SerovalTransportError);
  });

  it('refuses a frame larger than maxFrameSize from its header', () => {
    const header = encodeFrame([0, 'a', 'x'.repeat(100)])[0];
    expect(() => decode([header], 10)).toThrow(/larger than the limit/);
  });

  it('decodes a frame sent in many small chunks in linear time', () => {
    const [header, data] = encodeFrame([0, 'a', 'x'.repeat(200_000)]);
    const chunks = [header];
    for (let i = 0; i < data.length; i++) {
      chunks.push(data.subarray(i, i + 1));
    }
    const start = performance.now();
    expect(decode(chunks)).toEqual([[0, 'a', 'x'.repeat(200_000)]]);
    // Shifting each piece off the array made this take tens of seconds.
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('refuses an empty frame as malformed', () => {
    const header = new TextEncoder().encode(';0x00000000;');
    expect(() => decode([header])).toThrow(SerovalTransportError);
  });

  it('throws on a malformed header or data', () => {
    expect(() => decode([new TextEncoder().encode('<html><body>')])).toThrow(SerovalTransportError);
    const data = new TextEncoder().encode('{bad');
    const header = new TextEncoder().encode(`;0x${data.length.toString(16).padStart(8, '0')};`);
    expect(() => decode([header, data])).toThrow(SerovalTransportError);
  });
});
