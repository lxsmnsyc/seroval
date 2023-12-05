import { createStream, crossSerializeStream, serializeAsync } from "./dist/esm/development/index.mjs";

const sleep = (value, ms) => (
  new Promise((res) => setTimeout(res, ms, value))
);

const stream = createStream({
  b: [],
  a: true,
});

stream.next('foo');
stream.next('bar');
stream.return('baz');

// crossSerializeStream(stream, {
//   onSerialize(data) {
//     console.log(data);
//   }
// })
console.log(await serializeAsync(stream));