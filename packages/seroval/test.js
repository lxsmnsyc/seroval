
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
      controller.enqueue('Count: ' + i++);
      if (i > 10) {
        controller.close();
        clearInterval(interval);
      }
    }, 1000);
  },
});


// const source = new ReadableStream({
//   start(controller) {
//     controller.enqueue('Hello');
//     controller.enqueue('World');
//     controller.close();
//   }
// });

serializer.write('1', source);
// serializer.write('2', Promise.resolve('Hello world'));
