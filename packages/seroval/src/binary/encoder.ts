function getSize(bytes: (number | Uint8Array)[]): number {
  let size = 0;
  for (let i = 0, len = bytes.length; i < len; i++) {
    const current = bytes[i];
    if (typeof current === 'number') {
      size++;
    } else {
      size += current.length;
    }
  }
  return size;
}

export function mergeBytes(bytes: (number | Uint8Array)[]) {
  const newArr = new Uint8Array(getSize(bytes));

  let index = 0;

  for (let i = 0, len = bytes.length; i < len; i++) {
    const current = bytes[i];
    if (typeof current === 'number') {
      newArr[index++] = current;
    } else {
      const size = current.length;
      newArr.set(current, index);
      index += size;
    }
  }

  return newArr;
}

export function encodeInteger(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const uint = new Uint32Array(buffer);
  uint[0] = value;
  return new Uint8Array(buffer);
}

export function encodeNumber(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const float = new Float64Array(buffer);
  float[0] = value;
  return new Uint8Array(buffer);
}

export function encodeString(value: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(value);
}

export function decodeNumber(value: Uint8Array): number {
  const view = new DataView(
    value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
  );
  return view.getFloat64(0, true);
}

export function decodeInteger(value: Uint8Array): number {
  const view = new DataView(
    value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
  );
  return view.getUint32(0, true);
}

export function decodeString(value: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(value);
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
    hex += code.toString(16);
  }
  return BigInt('0x' + hex);
}
