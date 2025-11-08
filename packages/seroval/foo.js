import { serialize } from "./dist/esm/development/index.mjs";


const BUFFER = new ArrayBuffer(16);
const EXAMPLE = new DataView(BUFFER, 0);
EXAMPLE.setUint8(1, 42);

console.log(serialize(EXAMPLE));