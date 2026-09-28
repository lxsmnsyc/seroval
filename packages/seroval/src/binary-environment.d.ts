// Types for the private `#seroval-binary` import. package.json selects
// core/binary-browser.ts or core/binary-neutral.ts output for each environment.
declare module '#seroval-binary' {
  export function encodeArrayBuffer(current: ArrayBuffer): string;
  export function decodeArrayBuffer(source: string): ArrayBuffer;
}
