
import { serialize } from './dist/esm/development/index.mjs';

// const instance = new Serializer({
//   globalIdentifier: 'test',
//   onData: console.log,
// });

// const example = { foo: 'bar' };

// function* hello() {
//   yield example;
// }

// instance.write('foo', hello());
// instance.write('bar', hello());

const example = {
  a: new Map(),
  b: new Set(),
};

example.a.set(example.a, example.b);

const example2 = {
  foo: new Map(),
  bar: new Set(),
};

example2.foo.set(example2.foo, example2.bar);
example2.heck = example;

console.log(serialize(example2));