export { ARRAY_BUFFER_CONSTRUCTOR as decodeArrayBuffer } from './constructors';

export function encodeArrayBuffer(current: ArrayBuffer): string {
  const bytes = new Uint8Array(current);
  if (typeof bytes.toBase64 === 'function') {
    return bytes.toBase64();
  }
  let result = '';
  for (let i = 0, len = bytes.length; i < len; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return btoa(result);
}
