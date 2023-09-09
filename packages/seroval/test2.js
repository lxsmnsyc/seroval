
import { crossSerializeStream } from './dist/esm/development/index.mjs';

const source = new ReadableStream({
  start(controller) {
    controller.enqueue('Hello');
    controller.enqueue('World');
    controller.close();
  }
})

crossSerializeStream(source, {
  onSerialize(data) {
    console.log([data]);
  }
});
