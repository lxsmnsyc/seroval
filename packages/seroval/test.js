
import { Serializer } from './dist/esm/development/index.mjs';

const serializer = new Serializer({
  globalIdentifier: '__SOLID__',
  onData(value) {
    console.log(value);
  },
});

console.log(serializer.getHeader());

const source = new ReadableStream({
  start(controller) {
    let i = 0;

    const interval = setInterval(() => {
      if (i > 10) {
        controller.close();
        clearInterval(interval);
      } else {
        controller.enqueue('Count: ' + i++);
      }
    }, 1000);
  },
});

serializer.write('1', source);
