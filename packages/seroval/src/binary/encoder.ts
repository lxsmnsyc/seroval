// Multi-byte values are written in the platform's byte order. The `Preamble`
// node tells the decoder which order that is.
export const NATIVE_LITTLE_ENDIAN =
  /* @__PURE__ */ new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

const ENCODER = /* @__PURE__ */ new TextEncoder();
const DECODER = /* @__PURE__ */ new TextDecoder();

// The top bit of a String node's byte length says its bytes are UTF-16 code
// units instead of UTF-8. UTF-8 cannot hold a lone surrogate, so only strings
// that are not well formed use it.
export const STRING_UTF16_FLAG = 0x80000000;
export const STRING_LENGTH_MASK = 0x7fffffff;

// `String.prototype.isWellFormed` is ES2024, so older runtimes scan by hand.
const HAS_IS_WELL_FORMED = typeof String.prototype.isWellFormed === 'function';

function isWellFormed(value: string, start: number): boolean {
  if (HAS_IS_WELL_FORMED) {
    return value.isWellFormed();
  }
  for (let i = start, len = value.length; i < len; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      // A high surrogate must be followed by a low one, and a low surrogate
      // is only valid after a high one, which the step below skips.
      if (code > 0xdbff) {
        return false;
      }
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return false;
      }
      i++;
    }
  }
  return true;
}

const INITIAL_CAPACITY = 1024;
// A writer whose buffer grew past this size gets a new, small one after a
// flush, so a long running stream does not hold on to its largest payload.
const MAX_RETAINED_CAPACITY = 64 * 1024;

/**
 * A growable byte buffer. Nodes are written into it directly, and `flushBytes`
 * hands the written bytes over as one chunk.
 */
export interface ByteWriter {
  bytes: Uint8Array;
  view: DataView;
  offset: number;
}

export function createByteWriter(): ByteWriter {
  const bytes = new Uint8Array(INITIAL_CAPACITY);
  return {
    bytes,
    view: new DataView(bytes.buffer),
    offset: 0,
  };
}

function setCapacity(writer: ByteWriter, capacity: number): void {
  const bytes = new Uint8Array(capacity);
  bytes.set(writer.bytes.subarray(0, writer.offset));
  writer.bytes = bytes;
  writer.view = new DataView(bytes.buffer);
}

// Makes room for `size` more bytes.
export function reserveBytes(writer: ByteWriter, size: number): void {
  const required = writer.offset + size;
  let capacity = writer.bytes.length;
  if (required > capacity) {
    while (required > capacity) {
      capacity *= 2;
    }
    setCapacity(writer, capacity);
  }
}

/**
 * Returns a copy of the written bytes, or `undefined` if nothing was written,
 * and empties the writer.
 */
export function flushBytes(writer: ByteWriter): Uint8Array | undefined {
  if (writer.offset === 0) {
    return undefined;
  }
  const result = writer.bytes.slice(0, writer.offset);
  writer.offset = 0;
  if (writer.bytes.length > MAX_RETAINED_CAPACITY) {
    setCapacity(writer, INITIAL_CAPACITY);
  }
  return result;
}

// The write functions below expect the space to be reserved already.

export function writeByte(writer: ByteWriter, value: number): void {
  writer.bytes[writer.offset++] = value;
}

export function writeUint(writer: ByteWriter, value: number): void {
  writer.view.setUint32(writer.offset, value, NATIVE_LITTLE_ENDIAN);
  writer.offset += 4;
}

export function writeInt(writer: ByteWriter, value: number): void {
  writer.view.setInt32(writer.offset, value, NATIVE_LITTLE_ENDIAN);
  writer.offset += 4;
}

export function writeNumber(writer: ByteWriter, value: number): void {
  writer.view.setFloat64(writer.offset, value, NATIVE_LITTLE_ENDIAN);
  writer.offset += 8;
}

export function writeBytes(writer: ByteWriter, value: Uint8Array): void {
  writer.bytes.set(value, writer.offset);
  writer.offset += value.length;
}

/**
 * Writes the string as a `uint32` byte length followed by its UTF-8 bytes, or
 * by its UTF-16 code units when it holds a lone surrogate. Reserves its own
 * space.
 */
export function writeString(writer: ByteWriter, value: string): void {
  const length = value.length;
  // UTF-8 needs at most 3 bytes per UTF-16 code unit.
  reserveBytes(writer, 4 + length * 3);
  const start = writer.offset + 4;
  const bytes = writer.bytes;
  // Most strings are ASCII, which is cheaper to copy by hand than to send
  // through the encoder.
  let i = 0;
  for (; i < length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0x7f) {
      break;
    }
    bytes[start + i] = code;
  }
  if (i < length && !isWellFormed(value, i)) {
    // UTF-16 needs 2 bytes per code unit, which fits in the space reserved
    // above.
    const view = writer.view;
    for (let j = 0; j < length; j++) {
      view.setUint16(start + j * 2, value.charCodeAt(j), NATIVE_LITTLE_ENDIAN);
    }
    writeUint(writer, length * 2 + STRING_UTF16_FLAG);
    writer.offset += length * 2;
    return;
  }
  let size = i;
  if (i < length) {
    size += ENCODER.encodeInto(value.substring(i), bytes.subarray(start + i)).written;
  }
  writeUint(writer, size);
  writer.offset += size;
}

export function decodeString(value: Uint8Array): string {
  return DECODER.decode(value);
}

// Code units passed to one `String.fromCharCode` call, so a long string does
// not exceed the argument limit.
const CODE_UNIT_CHUNK = 8192;

/** Reads `length` UTF-16 code units from `view`, starting at `offset`. */
export function decodeStringUTF16(
  view: DataView,
  offset: number,
  length: number,
  littleEndian: boolean,
): string {
  const units: number[] = [];
  let result = '';
  for (let i = 0; i < length; i += CODE_UNIT_CHUNK) {
    const end = Math.min(length, i + CODE_UNIT_CHUNK);
    units.length = end - i;
    for (let j = i; j < end; j++) {
      units[j - i] = view.getUint16(offset + j * 2, littleEndian);
    }
    result += String.fromCharCode.apply(null, units);
  }
  return result;
}

export function encodeBigint(value: bigint): string {
  // Convert to hex
  const hex = value.toString(16);
  // Assume hex is by pairs
  const size = Math.ceil(hex.length / 2) * 2;
  // Pad initial
  const newHex = hex.padStart(size, '0');

  // Encode every pair of hex as a code point
  let result = '';
  for (let i = 0; i < size; i += 2) {
    const sub = newHex.substring(i, i + 2);
    // parse substring
    const parsed = Number.parseInt(sub, 16);
    result += String.fromCharCode(parsed);
  }
  return result;
}

export function decodeBigint(value: string): bigint {
  let hex = '';
  for (let i = 0, len = value.length; i < len; i++) {
    const code = value.charCodeAt(i);
    hex += code.toString(16).padStart(2, '0');
  }
  return BigInt('0x' + hex);
}
