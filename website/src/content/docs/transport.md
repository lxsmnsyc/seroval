---
title: Transport
description: Send many streamed values over fetch, a WebSocket, a worker or any other connection with @seroval/transport.
type: guide
---

`@seroval/transport` sends values over a connection while they stream. A writer turns each value into messages under a key, and a reader turns the messages back into values. The messages are plain arrays, so any connection can carry them: a `fetch` body, a WebSocket, a `MessagePort` or a worker.

```bash
npm install seroval @seroval/transport
```

| Entry point | Exports |
| --- | --- |
| `@seroval/transport` | Everything in `@seroval/transport/read` and `@seroval/transport/write`. |
| `@seroval/transport/write` | [Writers](./transport/reference.md#the-writer): `createJSONWriter`, `createJSWriter`, `toJSONStream`, `toJSStream`. |
| `@seroval/transport/read` | [Readers](./transport/reference.md#the-reader): `createJSONReader`, `createJSReader`, `fromJSONStream`, `fromJSStream`. |
| `@seroval/transport/web` | [Web streams](#over-fetch) and [form data](#files-in-a-request): `toWebStream`, `fromWebStream`, `toResponse`, `fromResponse`, `toFormData`, `fromFormData`, `toFormRequest`, `fromFormRequest`. |
| `@seroval/transport/node` | [Node streams](#over-node-streams): `toNodeStream`, `fromNodeStream`. |
| `@seroval/transport/frame` | [Frames](./transport/protocol.md#frames): `encodeFrame`, `createFrameDecoder`. |

Every entry point also exports `SerovalTransportError`.

## Over `fetch`

`@seroval/transport/web` connects a writer and a reader to web streams. `toWebStream` turns the messages of a writer into a `ReadableStream<Uint8Array>`, and `fromWebStream` reads them back into a reader.

1. On the server, create a writer inside `toWebStream`, write each value under a key, and flush.
2. Return the stream as the body of a `Response`.
3. On the client, create a reader and pass it the response body with `fromWebStream`.
4. Read each value with `reader.get(key)`.

```js
// server
import { createJSONWriter } from '@seroval/transport/write';
import { toWebStream } from '@seroval/transport/web';

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
import { createJSONReader } from '@seroval/transport/read';
import { fromWebStream } from '@seroval/transport/web';

const response = await fetch('/api');
const reader = createJSONReader();
void fromWebStream(response.body, reader);
const user = await reader.get('user');
console.log(await reader.get('posts'));
```

`get` resolves as soon as the first message of the key arrives. Later messages settle the promises and streams in the value.

`toResponse` and `fromResponse` do the same with a `Response`:

```js
// server
return toResponse((sink) => toJSONStream(data, sink), { headers: { 'cache-control': 'no-store' } });

// client
const reader = createJSONReader();
void fromResponse(await fetch('/api'), reader);
```

- `toResponse` takes the options of `Response` and `highWaterMark`. It sets `Content-Type: application/octet-stream` unless the headers set one.
- `fromResponse` takes the options of `fromWebStream`. A response without a body, or with a status outside 200 to 299, ends the reader with a `SerovalTransportError`.

## Files in a request

A request body that streams needs `duplex: 'half'`, which not every browser supports. `toFormRequest` sends a value in a `Request` as form data instead. Each file and blob in the value goes in a part of its own, and the value holds only its index, so the bytes are not base64 in the JSON. Form data in the value works too. It needs no plugin of `seroval-plugins/web`.

```js
// client
import { toFormRequest } from '@seroval/transport/web';

const request = await toFormRequest('/api/upload', {
  title: 'Report',
  attachments: [input.files[0], input.files[1]],
});
await fetch(request);
```

```js
// server
import { fromFormRequest } from '@seroval/transport/web';

const { title, attachments } = await fromFormRequest(request);
```

- `toFormData(value, options)` and `fromFormData(form, options)` do the same with a `FormData`, such as to add fields of your own.
- The value goes in the `seroval` field as JSON, and the file of index `i` in the `seroval:i` field.
- Promises in the value are awaited before the request is created.
- `toFormData` takes the options of `toJSONAsync`, and `fromFormData` those of `fromJSON`. Your plugins come after the ones of files and form data.
- `fromFormData` validates the value and runs no code, as `fromJSON` does, so the form can come from an untrusted client.
- `request.formData()` reads the whole body, so limit the size of the body in the server first.
- A blob comes back as a `Blob`, and a file as a `File` with its name, type and `lastModified`.

## Over Node streams

`@seroval/transport/node` does the same with Node streams. `toNodeStream` returns a `Readable` of frames, and `fromNodeStream` reads a `Readable`, such as an `IncomingMessage`.

```js
// server
import { pipeline } from 'node:stream';
import { createJSONWriter } from '@seroval/transport/write';
import { toNodeStream } from '@seroval/transport/node';

http.createServer((req, res) => {
  const body = toNodeStream((sink) => {
    const writer = createJSONWriter(sink);
    writer.write('user', user);
    writer.flush();
    return writer;
  });
  pipeline(body, res, () => {});
});
```

```js
// client
import { createJSONReader } from '@seroval/transport/read';
import { fromNodeStream } from '@seroval/transport/node';

http.get(url, (res) => {
  const reader = createJSONReader();
  void fromNodeStream(res, reader);
});
```

- `toNodeStream` takes `highWaterMark`, in bytes. It defaults to 64KiB.
- Destroying the `Readable` closes the writer. `pipeline` destroys it when the response closes early, while `pipe` does not.
- `fromNodeStream` takes the options of `fromWebStream`. A stream must carry bytes, so do not call `setEncoding` on it.

## Over messages

Without `toWebStream`, the writer calls `send` with each message, and the reader takes each one with `push`.

```js
// worker
const writer = createJSONWriter({ send: (message) => self.postMessage(message) });
writer.write('results', search(query));

// page
const reader = createJSONReader();
worker.onmessage = (event) => reader.push(event.data);
const results = await reader.get('results');
```

A JSON message holds `SerovalNode` objects, so `postMessage` sends it as is. For a WebSocket, send `JSON.stringify(message)` and push `JSON.parse(event.data)`.

## One value

`toJSONStream` writes one value and flushes, and `fromJSONStream` reads it as `value`. Its `settled` promise resolves once everything in the value settled.

```js
const body = toWebStream((sink) => toJSONStream({ user, posts: fetchPosts() }, sink));

const reader = fromJSONStream();
void fromWebStream(response.body, reader);
const data = await reader.value;
```

## References

By default, each value has its own references. An object that appears twice in one value is one object on the reader, but the same object in two values is two copies. The references of a value are freed when it is done. A connection that stays open only keeps the references of values that are still sending.

With `sharedRefs: true` on both sides, every value shares one set of references, as with the [`Serializer` class](./streaming.md#the-serializer-class). A later value can then refer to an earlier one. The references are kept until the writer is done. A value that fails or that the reader cancels cannot fail what waits in it alone, so its promises and streams fail when the reader ends.

## Backpressure and cancelling

- When `send` returns a promise, seroval holds back the next message of that value until it settles. A [live stream](./streams-and-iterables.md#live-streams) source also pauses.
- `toWebStream` returns that promise when its queue is full, until the stream is read again. Set the size of the queue with `highWaterMark`, in bytes. It defaults to 64KiB.
- Cancelling the stream of `toWebStream` closes the writer, which stops every source that is still running, such as when the client disconnects.
- Promises in a value that nobody awaits do not cause unhandled rejections.

## Code format

`createJSWriter` and `createJSReader` send code instead of JSON nodes. The reader runs each message with `eval`, so only read it from a writer you trust. Both sides need the same `scopeId`, and every value shares the references of `$R[scopeId]`:

```js
const writer = createJSWriter({ scopeId: 'page', send });
const reader = createJSReader({ scopeId: 'page' });
```

`toJSStream` and `fromJSStream` send one value. The code declares `$R` on `self`. Node does not define `self`, so read this format in a browser or a worker.

## Related

- [Transport reference](./transport/reference.md)
- [Transport message format](./transport/protocol.md)
- [Streaming](./streaming.md)
- [RPC](./rpc.md), for typed calls over the same messages
