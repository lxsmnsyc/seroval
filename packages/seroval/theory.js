import { Serializer } from "./dist/esm/development/index.mjs";

const sleep = (value, ms) => (
  new Promise((res) => setTimeout(res, ms, value))
);

async function * example() {
  yield sleep('foo', 1000);
  yield sleep('bar', 1000);
  yield sleep('baz', 1000);
}

const serializer = new Serializer({
  globalIdentifier: 'X',
  onData(value) {
    console.log(value);
  },
});

serializer.write('example', example());