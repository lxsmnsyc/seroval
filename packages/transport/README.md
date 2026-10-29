# `@seroval/transport`

> Send seroval streams over `fetch`, WebSockets, workers and other connections

[![NPM](https://img.shields.io/npm/v/@seroval/transport.svg)](https://www.npmjs.com/package/@seroval/transport)

## Install

```bash
npm install --save seroval @seroval/transport
```

## Usage

```js
// server
import { createJSONWriter, toWebStream } from '@seroval/transport/write';

return new Response(
  toWebStream((sink) => {
    const writer = createJSONWriter(sink);
    writer.write('user', user);
    writer.write('posts', fetchPosts());
    writer.flush();
    return writer;
  }),
);
```

```js
// client
import { createJSONReader, fromWebStream } from '@seroval/transport/read';

const response = await fetch('/api');
const reader = createJSONReader();
void fromWebStream(response.body, reader);
const user = await reader.get('user');
console.log(await reader.get('posts'));
```

- The writer sends messages: plain arrays that `postMessage` can send as is. `toWebStream` and `fromWebStream` turn them into bytes and back.
- `send` can return a promise to hold back the next message, so a slow connection slows down the source.
- Either side can cancel one value. The writer stops its sources, and the reader fails what still waits in it.
- When the reader ends, every value and promise that still waits fails.
- Promises that nobody awaits do not cause unhandled rejections.

See the [docs](https://seroval.vercel.app/docs/transport) for the options and the message format.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
