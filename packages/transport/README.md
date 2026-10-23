# `seroval-transport`

> Send seroval streams over `fetch` and other byte streams

[![NPM](https://img.shields.io/npm/v/seroval-transport.svg)](https://www.npmjs.com/package/seroval-transport)

## Install

```bash
npm install --save seroval seroval-transport
```

## Usage

```js
// server
import { toJSONStream } from 'seroval-transport/write';

return new Response(toJSONStream({ user, posts: fetchPosts() }));
```

```js
// client
import { fromJSONStream } from 'seroval-transport/read';

const response = await fetch('/api');
const data = await fromJSONStream(response.body);
console.log(await data.posts);
```

- The writer holds back frames while the reader is slow.
- Cancelling the stream stops every source that is still running.
- When the stream ends early, every pending promise and stream fails.
- Promises that nobody awaits do not cause unhandled rejections.

See the [docs](https://seroval.vercel.app/docs/transport) for the options and the frame format.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
