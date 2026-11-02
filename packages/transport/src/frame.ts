import type { Message } from './message';
import { SerovalTransportError } from './message';

export type { Message } from './message';
export { SerovalTransportError } from './message';

/**
 * Each frame is a 12-byte header followed by the UTF-8 data. The header holds
 * the data size as 8 hex digits: `;0x0000002a;`. The reader knows the size
 * before it buffers the data, so it can refuse a frame that is too large.
 *
 * The header is the one SolidStart uses for server functions. The data is a
 * transport message, not a bare node.
 */
const FRAME_HEADER_SIZE = 12;

/** The default `maxFrameSize`, in bytes. */
const DEFAULT_MAX_FRAME_SIZE = 64 * 1024 * 1024;

const SEMICOLON = 0x3b;
const ZERO = 0x30;
const LOWER_X = 0x78;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createFrameHeader(size: number): Uint8Array {
  const hex = size.toString(16).padStart(8, '0');
  const header = new Uint8Array(FRAME_HEADER_SIZE);
  header[0] = SEMICOLON;
  header[1] = ZERO;
  header[2] = LOWER_X;
  for (let i = 0; i < 8; i++) {
    header[3 + i] = hex.charCodeAt(i);
  }
  header[11] = SEMICOLON;
  return header;
}

/**
 * Encodes `message` as one frame of JSON. The header and the data are
 * separate pieces, so the data is not copied into a second buffer. Send both,
 * in order.
 */
export function encodeFrame(message: Message): [Uint8Array, Uint8Array] {
  const encoded = encoder.encode(JSON.stringify(message));
  if (encoded.length > 0xffffffff) {
    throw new SerovalTransportError(
      `A frame of ${encoded.length} bytes does not fit in the header.`,
    );
  }
  return [createFrameHeader(encoded.length), encoded];
}

function hexValue(code: number): number {
  if (code >= 0x30 && code <= 0x39) {
    return code - 0x30;
  }
  if (code >= 0x61 && code <= 0x66) {
    return code - 0x61 + 10;
  }
  if (code >= 0x41 && code <= 0x46) {
    return code - 0x41 + 10;
  }
  return -1;
}

/** Returns the data size the header declares, or -1 when it is malformed. */
function parseFrameHeader(header: Uint8Array): number {
  if (
    header[0] !== SEMICOLON ||
    header[1] !== ZERO ||
    header[2] !== LOWER_X ||
    header[11] !== SEMICOLON
  ) {
    return -1;
  }
  let size = 0;
  for (let i = 3; i < 11; i++) {
    const digit = hexValue(header[i]);
    if (digit === -1) {
      return -1;
    }
    size = size * 16 + digit;
  }
  return size;
}

function malformed(): SerovalTransportError {
  return new SerovalTransportError('The stream has a malformed frame.');
}

export interface FrameDecoderOptions {
  /**
   * Receives each message, parsed but not checked. Pass it to `reader.push`,
   * which checks it.
   */
  onMessage(message: unknown): void;
  /** Refuses any frame larger than this many bytes. Defaults to 64MiB. */
  maxFrameSize?: number;
}

export interface FrameDecoder {
  /**
   * Takes the next bytes, in any size, and passes on every frame they
   * complete. Throws a `SerovalTransportError` on a malformed or oversized
   * frame. Stop decoding then.
   */
  push(chunk: Uint8Array): void;
  /** Throws a `SerovalTransportError` when the bytes end inside a frame. */
  end(): void;
}

/** Creates a decoder of the frames of `encodeFrame`. */
export function createFrameDecoder(options: FrameDecoderOptions): FrameDecoder {
  const maxFrameSize = options.maxFrameSize ?? DEFAULT_MAX_FRAME_SIZE;
  // Bytes received and not yet decoded, in order.
  let pieces: Uint8Array[] = [];
  let length = 0;
  // The data size of the frame being read, or -1 while its header is read.
  let size = -1;

  // Removes the first `count` bytes. Pieces are only joined when the bytes
  // span more than one, so each byte is copied at most once.
  function take(count: number): Uint8Array {
    const first = pieces[0];
    if (first.length >= count) {
      if (first.length === count) {
        pieces.shift();
      } else {
        pieces[0] = first.subarray(count);
      }
      length -= count;
      return first.subarray(0, count);
    }
    const result = new Uint8Array(count);
    let offset = 0;
    while (offset < count) {
      const piece = pieces[0];
      const part = Math.min(piece.length, count - offset);
      result.set(piece.subarray(0, part), offset);
      offset += part;
      if (part === piece.length) {
        pieces.shift();
      } else {
        pieces[0] = piece.subarray(part);
      }
    }
    length -= count;
    return result;
  }

  return {
    push(chunk) {
      if (chunk.length === 0) {
        return;
      }
      pieces.push(chunk);
      length += chunk.length;
      for (;;) {
        // Read the header, and refuse the frame before its data is buffered.
        if (size === -1) {
          if (length < FRAME_HEADER_SIZE) {
            return;
          }
          size = parseFrameHeader(take(FRAME_HEADER_SIZE));
          if (size === -1) {
            throw malformed();
          }
          if (size > maxFrameSize) {
            throw new SerovalTransportError(
              `A frame of ${size} bytes is larger than the limit of ${maxFrameSize} bytes.`,
            );
          }
        }

        // Read the data once all of it arrived.
        if (length < size) {
          return;
        }
        const data = decoder.decode(take(size));
        size = -1;
        let message: unknown;
        try {
          message = JSON.parse(data);
        } catch {
          throw malformed();
        }
        options.onMessage(message);
      }
    },
    end() {
      const partial = size !== -1 || length > 0;
      pieces = [];
      length = 0;
      size = -1;
      if (partial) {
        throw malformed();
      }
    },
  };
}
