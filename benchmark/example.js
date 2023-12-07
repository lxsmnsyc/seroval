import { serializeAsync } from 'seroval';
import { BlobPlugin } from 'seroval-plugins/web';

const example = new Blob(['Hello, World!'], { type: 'text/plain '});
console.log(await serializeAsync(example, {
  plugins: [
    BlobPlugin,
  ],
}));