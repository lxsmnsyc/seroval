---
title: Quick start
description: Install seroval, serialize a value, and read it back.
---

## Install

```bash
npm install seroval
```

seroval has no dependencies. It works in Node.js, Deno, Bun, browsers and edge runtimes. For web types such as `Request` or `FormData`, also install the plugins:

```bash
npm install seroval-plugins
```

## Serialize to JavaScript

`serialize` returns a JavaScript expression. Running the expression rebuilds the value.

```js
import { deserialize, serialize } from 'seroval';

const value = {
  tags: new Set(['a', 'b']),
  created: new Date('2026-01-01'),
};

const source = serialize(value);
// ({tags:new Set(["a","b"]),created:new Date("2026-01-01T00:00:00.000Z")})

const copy = deserialize(source);
copy.tags.has('a'); // true
```

`deserialize` runs the string with `eval`. Use it only on output you produced yourself, or output from a source you trust.

## Send values with promises

`serializeAsync` waits for every promise in the value, then returns the result.

```js
import { serializeAsync } from 'seroval';

const source = await serializeAsync({
  user: fetchUser(), // a Promise
});
```

The output still contains a promise, which resolves right away when the output runs.

## Receive data from a client

Output that a client sends you must never be evaluated. Use the JSON form instead. `fromJSON` validates the tree and rebuilds the value without running any code.

```js
import { fromJSON, toJSON } from 'seroval';

// On the client
const body = JSON.stringify(toJSON({ when: new Date(), ids: new Set([1, 2]) }));

// On the server
const value = fromJSON(JSON.parse(body));
value.ids instanceof Set; // true
```

## Stream to the browser

`crossSerializeStream` sends the parts of a value that are ready right away, then sends each promise as it settles. Each chunk is a script for the page.

```js
import { crossSerializeStream, getCrossReferenceHeader } from 'seroval';

response.write(`<script>${getCrossReferenceHeader()}</script>`);

crossSerializeStream(
  { user: 'Ada', posts: fetchPosts() },
  {
    onSerialize(chunk, initial) {
      if (initial) {
        response.write(`<script>window.DATA=${chunk}</script>`);
      } else {
        response.write(`<script>${chunk}</script>`);
      }
    },
    onDone() {
      response.end();
    },
  },
);
```

The [streaming guide](./streaming.md) covers this in detail.

## Next steps

- [Choosing a mode](./choosing-a-mode.md) compares every output format.
- [Security](./security.md) explains which functions are safe for untrusted input.
