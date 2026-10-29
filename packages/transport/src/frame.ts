import { SerovalTransportError } from './message';

/**
 * Each frame is a 12-byte header followed by the UTF-8 data. The header holds
 * the data size as 8 hex digits: `;0x0000002a;`. The reader knows the size
 * before it buffers the data, so it can refuse a frame that is too large.
 *
 * The header is the one SolidStart uses for server functions. The data is a
 * transport message, not a bare node.
 */
export const FRAME_HEADER_SIZE = 12;

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
 * Encodes `data` as one frame. The header and the data are separate pieces,
 * so the data is not copied into a second buffer.
 */
export function encodeFrame(data: string): [Uint8Array, Uint8Array] {
  const encoded = encoder.encode(data);
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

export class FrameReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;

  private done = false;

  /** Pieces read from the stream and not yet consumed, in order. */
  private pieces: Uint8Array[] = [];

  private length = 0;

  constructor(
    stream: ReadableStream<Uint8Array>,
    private maxFrameSize: number,
  ) {
    this.reader = stream.getReader();
  }

  /** Reads until `size` bytes are buffered or the stream ends. */
  private async fill(size: number): Promise<void> {
    while (this.length < size && !this.done) {
      const result = await this.reader.read();
      if (result.done) {
        this.done = true;
      } else if (result.value.length > 0) {
        this.pieces.push(result.value);
        this.length += result.value.length;
      }
    }
  }

  /**
   * Removes the first `size` bytes from the buffer. Pieces are only joined
   * when the bytes span more than one, so each byte is copied at most once.
   */
  private take(size: number): Uint8Array {
    const first = this.pieces[0];
    if (first && first.length >= size) {
      if (first.length === size) {
        this.pieces.shift();
      } else {
        this.pieces[0] = first.subarray(size);
      }
      this.length -= size;
      return first.subarray(0, size);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      const piece = this.pieces[0];
      const count = Math.min(piece.length, size - offset);
      result.set(piece.subarray(0, count), offset);
      offset += count;
      if (count === piece.length) {
        this.pieces.shift();
      } else {
        this.pieces[0] = piece.subarray(count);
      }
    }
    this.length -= size;
    return result;
  }

  /** Returns the data of the next frame, or `undefined` at the end. */
  async next(): Promise<string | undefined> {
    await this.fill(FRAME_HEADER_SIZE);
    if (this.length === 0) {
      return undefined;
    }
    if (this.length < FRAME_HEADER_SIZE) {
      throw malformed();
    }
    const size = parseFrameHeader(this.take(FRAME_HEADER_SIZE));
    if (size === -1) {
      throw malformed();
    }
    if (size > this.maxFrameSize) {
      throw new SerovalTransportError(
        `A frame of ${size} bytes is larger than the limit of ${this.maxFrameSize} bytes.`,
      );
    }
    await this.fill(size);
    if (this.length < size) {
      throw malformed();
    }
    return decoder.decode(this.take(size));
  }

  /** Stops reading and releases the stream. */
  async cancel(reason?: unknown): Promise<void> {
    this.pieces = [];
    this.length = 0;
    this.done = true;
    await this.reader.cancel(reason).catch(() => {});
  }
}
