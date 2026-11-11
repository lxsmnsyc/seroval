import type { Message } from './message';
import { DATA, SerovalTransportError } from './message';

export type { Message } from './message';
export { SerovalTransportError } from './message';

/**
 * Each frame is a 12-byte header followed by the UTF-8 data. The header holds
 * the data size as 8 hex digits: `;0x0000002a;`. The reader knows the size
 * before it buffers the data, so it can refuse a frame that is too large.
 *
 * The header is the one SolidStart uses for server functions. The data is a
 * transport message, not a bare node.
 *
 * A data message whose data is bytes, as binary mode sends, is not JSON. Its
 * frame data is a zero byte, the size of the key in UTF-8 as a big-endian
 * 32-bit integer, the key, and then the bytes. JSON never starts with a zero
 * byte, so one decoder reads both kinds.
 */
const FRAME_HEADER_SIZE = 12;

/** The default `maxFrameSize`, in bytes. */
const DEFAULT_MAX_FRAME_SIZE = 64 * 1024 * 1024;

/** The first byte of the data of a frame that carries bytes. */
const BYTES_TAG = 0x00;
/** The tag and the key size that come before the key in such a frame. */
const BYTES_PREFIX_SIZE = 5;

const SEMICOLON = 0x3b;
const ZERO = 0x30;
const LOWER_X = 0x78;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
// Keys of byte frames must be valid UTF-8, so a broken one is refused
// instead of read as a different key.
const keyDecoder = new TextDecoder('utf-8', { fatal: true });

function assertFrameSize(size: number): void {
  if (size > 0xffffffff) {
    throw new SerovalTransportError(`A frame of ${size} bytes does not fit in the header.`);
  }
}

/** Creates the header of a frame, with `extra` bytes of room after it. */
function createFrameHeader(size: number, extra = 0): Uint8Array {
  const hex = size.toString(16).padStart(8, '0');
  const header = new Uint8Array(FRAME_HEADER_SIZE + extra);
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
 * Encodes `message` as one frame, of JSON or, when its data is bytes, of
 * those bytes. The header and the data are separate pieces, so the data is
 * not copied into a second buffer. Send both, in order.
 */
export function encodeFrame(message: Message): [Uint8Array, Uint8Array] {
  if (message[0] === DATA && message[2] instanceof Uint8Array) {
    return encodeBytesFrame(message[1], message[2]);
  }
  const encoded = encoder.encode(JSON.stringify(message));
  assertFrameSize(encoded.length);
  return [createFrameHeader(encoded.length), encoded];
}

/** Encodes a data message of bytes. The key goes in the first piece. */
function encodeBytesFrame(key: string, data: Uint8Array): [Uint8Array, Uint8Array] {
  const encodedKey = encoder.encode(key);
  const extra = BYTES_PREFIX_SIZE + encodedKey.length;
  assertFrameSize(extra + data.length);
  const head = createFrameHeader(extra + data.length, extra);
  head[FRAME_HEADER_SIZE] = BYTES_TAG;
  new DataView(head.buffer).setUint32(FRAME_HEADER_SIZE + 1, encodedKey.length);
  head.set(encodedKey, FRAME_HEADER_SIZE + BYTES_PREFIX_SIZE);
  return [head, data];
}

/** Decodes the data of a frame that carries bytes, or throws when it is malformed. */
function decodeBytesFrame(data: Uint8Array): Message<Uint8Array> {
  if (data.length < BYTES_PREFIX_SIZE) {
    throw malformed();
  }
  const keySize = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(1);
  const end = BYTES_PREFIX_SIZE + keySize;
  if (end > data.length) {
    throw malformed();
  }
  let key: string;
  try {
    key = keyDecoder.decode(data.subarray(BYTES_PREFIX_SIZE, end));
  } catch {
    throw malformed();
  }
  return [DATA, key, data.subarray(end)];
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
  // Bytes received and not yet decoded, in order, from `pieces[head]`.
  let pieces: Uint8Array[] = [];
  let head = 0;
  let length = 0;
  // The data size of the frame being read, or -1 while its header is read.
  let size = -1;

  // Drops the first piece. Moving `head` instead of shifting the array keeps
  // a frame sent in many small chunks linear in its chunks.
  function dropPiece(): void {
    head++;
    if (head === pieces.length) {
      pieces = [];
      head = 0;
    }
  }

  // Removes the first `count` bytes. Pieces are only joined when the bytes
  // span more than one, so each byte is copied at most once.
  function take(count: number): Uint8Array {
    if (count === 0) {
      return new Uint8Array(0);
    }
    const first = pieces[head];
    if (first.length >= count) {
      if (first.length === count) {
        dropPiece();
      } else {
        pieces[head] = first.subarray(count);
      }
      length -= count;
      return first.subarray(0, count);
    }
    const result = new Uint8Array(count);
    let offset = 0;
    while (offset < count) {
      const piece = pieces[head];
      const part = Math.min(piece.length, count - offset);
      result.set(piece.subarray(0, part), offset);
      offset += part;
      if (part === piece.length) {
        dropPiece();
      } else {
        pieces[head] = piece.subarray(part);
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
        const data = take(size);
        size = -1;
        let message: unknown;
        if (data[0] === BYTES_TAG) {
          message = decodeBytesFrame(data);
        } else {
          try {
            message = JSON.parse(decoder.decode(data));
          } catch {
            throw malformed();
          }
        }
        options.onMessage(message);
      }
    },
    end() {
      const partial = size !== -1 || length > 0;
      pieces = [];
      head = 0;
      length = 0;
      size = -1;
      if (partial) {
        throw malformed();
      }
    },
  };
}
