
import { Serializer } from './dist/esm/development/index.mjs';

const serializer = new Serializer({
  globalIdentifier: '__SOLID__',
  onHeader(value) {
    console.log('HEADER', value);
  },
  onData(value) {
    console.log([value]);
  },
});

const delay = (value, ms) => new Promise(r => setTimeout(r, ms, value));

const source = {
  a: delay('A', 300),
  b: delay('B', 200),
  c: delay('C', 100),
};

serializer.write('1', source);
