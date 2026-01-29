export function bigintToBytes(value: bigint): string {
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
