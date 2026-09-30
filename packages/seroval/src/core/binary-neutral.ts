import {
  decodeArrayBuffer as decodePortable,
  encodeArrayBuffer as encodePortable,
} from './binary-browser';

const MIN_NATIVE_BASE64_LENGTH = 512;

export function encodeArrayBuffer(current: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(current).toString('base64');
  }
  return encodePortable(current);
}

export function decodeArrayBuffer(source: string): ArrayBuffer {
  if (
    source.length < MIN_NATIVE_BASE64_LENGTH ||
    typeof Buffer === 'undefined'
  ) {
    return decodePortable(source);
  }
  // Keep atob's validation; Buffer's base64 decoder accepts malformed input.
  const decoded = atob(source);
  const buffer = new ArrayBuffer(decoded.length);
  Buffer.from(buffer).write(decoded, 'latin1');
  return buffer;
}
