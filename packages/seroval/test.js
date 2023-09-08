
import { Serializer } from './dist/esm/development/index.mjs';

const serializer = new Serializer({
  globalIdentifier: '__SOLID__',
  onData(value) {
    console.log([value]);
  },
});

console.log('HEADER', [serializer.getHeader()]);

const delay = (value, ms) => new Promise(r => setTimeout(r, ms, value));

const source = ({
  a: delay('A', 300),
  b: delay('B', 200),
  c: delay('C', 100),
});

source.d = delay(source, 400);

serializer.write('1', source);
