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
  const arr = new Uint8Array(4);
  arr[0] = (value & 0xff000000) >> 24;
  arr[1] = (value & 0x00ff0000) >> 16;
  arr[2] = (value & 0x0000ff00) >> 8;
  arr[3] = value & 0x000000ff;
  return arr;
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
