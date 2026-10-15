import { serializeAsync } from 'seroval';
import { BlobPlugin } from 'seroval-plugins/web';

const example = new Blob(['Hello, World!'], { type: 'text/plain ' });
// oxlint-disable-next-line no-console -- The example prints the serialized output.
console.log(
  await serializeAsync(example, {
    plugins: [BlobPlugin],
  }),
);
