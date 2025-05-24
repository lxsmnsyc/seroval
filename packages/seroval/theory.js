import { toCrossJSONStream, fromCrossJSON, crossSerializeStream } from "./dist/esm/development/index.mjs";

const delay = (delay, value) => new Promise((resolve) => {
  setTimeout(() => resolve(value), delay)
})

const bla = {
  a: 'Hello',
  b: delay(1000, "World"),
  c: delay(2000, "Bla"),
  d: delay(3000, {
    e: 2500
  })
}

const refs = new Map();

toCrossJSONStream(bla, {
  onParse(node, initial) {
    console.log(fromCrossJSON(node, { refs }))
  }
});

// crossSerializeStream(bla, {
//   onSerialize(node) {
//     console.log(node);
//   }
// })