---
title: Transport
description: Send a streamed value over fetch or any byte stream with @seroval/transport.
---

`@seroval/transport` turns a value into a `ReadableStream<Uint8Array>` and back. Use it as a `fetch` body, a `Response` body, or any other byte stream.

```bash
npm install seroval @seroval/transport
```

```js
// server
import { toJSONStream } from '@seroval/transport/write';

return new Response(toJSONStream({ user, posts: fetchPosts() }));
```

```js
// client
import { fromJSONStream } from '@seroval/transport/read';

const response = await fetch('/api');
const data = await fromJSONStream(response.body);
console.log(data.user);
console.log(await data.posts);
```

`fromJSONStream` resolves as soon as the first frame arrives. Later frames settle the promises and streams in the value.

## What it handles

- It holds back the next frame while the reader is slow. A [live stream](./streams-and-iterables.md#live-streams) source also pauses.
- Cancelling the stream stops every source that is still running, such as when the client disconnects.
- When the stream ends early or fails, every promise and stream that is still waiting fails with the error.
- Promises in the value that nobody awaits do not cause unhandled rejections. In the code format, this only covers promises that are still pending when the stream fails.
- The reader refuses a frame larger than `maxFrameSize` before it buffers it.

## Two formats

| Writer | Reader | Notes |
| --- | --- | --- |
| `toJSONStream` | `fromJSONStream` | Cross-reference JSON. The reader never runs code. |
| `toJSStream` | `fromJSStream` | Code that the reader runs with `eval`. Only read it from a writer you trust. |

Both sides of `toJSStream` need the same `scopeId`:

```js
const body = toJSStream(value, { scopeId: 'page' });
const data = await fromJSStream(body, { scopeId: 'page' });
```

The code declares `$R` on `self`. Node does not define `self`, so read this format in a browser or a worker.

## Options

`toJSONStream` takes the options of [`toCrossJSONStream`](./streaming.md#streaming-json), such as `plugins`, `disabledFeatures` and `depthLimit`. `toJSStream` takes the options of [`crossSerializeStream`](./streaming.md#options). Both also take:

| Option | Description |
| --- | --- |
| `highWaterMark` | How many bytes the stream buffers before it holds back the next frame. Defaults to 64KiB. |

`fromJSONStream` takes the options of [`createCrossDeserializer`](./streaming.md#receiving-a-json-stream). Both readers also take:

| Option | Description |
| --- | --- |
| `maxFrameSize` | Refuses any frame larger than this many bytes. Defaults to 64MiB. |
| `signal` | An `AbortSignal`. Aborting it stops reading and fails every value that is still waiting. |
| `onError(error)` | Receives an error from a frame after the first one, such as a malformed frame. |

Pass the same `plugins` to the writer and the reader.

## Errors

The readers reject with `SerovalFrameError` when:

- the stream ends before the first frame.
- a frame header is malformed.
- a frame is larger than `maxFrameSize`.

A pending value fails with `SerovalFrameError` when the stream ends before it settles.

## Frame format

Each frame is a 12-byte header followed by the UTF-8 data. The header holds the data size as 8 hex digits.

```
;0x0000000f;{"t":1,"s":"a"}
```

This is the format that SolidStart uses for server functions.
