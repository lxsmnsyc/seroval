---
title: Transport
description: Send many streamed values over fetch, a WebSocket, a worker or any other connection with @seroval/transport.
---

`@seroval/transport` sends values over a connection while they stream. A writer turns each value into messages under a key, and a reader turns the messages back into values. The messages are plain arrays, so any connection can carry them: a `fetch` body, a WebSocket, a `MessagePort` or a worker.

```bash
npm install seroval @seroval/transport
```

## Over `fetch`

`@seroval/transport/web` connects a writer and a reader to web streams. `toWebStream` turns the messages of a writer into a `ReadableStream<Uint8Array>`, and `fromWebStream` reads them back into a reader.

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

## The writer

| Method | Description |
| --- | --- |
| `write(key, value)` | Starts sending `value` under `key`. Each key can be written once. |
| `push(value)` | Starts sending `value` under the next unused number, and returns the key. |
| `cancel(key, reason?)` | Stops one value and its sources, and tells the reader it failed. |
| `flush()` | Takes no more values, and calls `onDone` once every value is done. |
| `close(reason?)` | Stops every value, tells the reader they failed, and calls `onDone`. |

`createJSONWriter` takes the options of [`toCrossJSONStream`](./streaming.md#streaming-json), such as `plugins`, `disabledFeatures` and `depthLimit`. It also takes:

| Option | Description |
| --- | --- |
| `send(message)` | Sends one message. Return a promise to hold back the next message of the same value until it settles. |
| `onDone()` | Runs once, after `flush` when every value is done, or after `close`. |
| `onError(error, key)` | Receives an error that stopped a value, such as a value seroval cannot serialize. The reader only learns that the value failed. |
| `signal` | An `AbortSignal`. Aborting it closes the writer with the abort reason. |
| `sharedRefs` | Shares one set of references across every value. See [References](#references). |

## The reader

| Method | Description |
| --- | --- |
| `push(message)` | Takes the next message. Throws a `SerovalTransportError` on a malformed message. End the reader with that error then. |
| `get(key)` | A promise of the value of `key`. |
| `settled(key)` | Resolves once the value of `key` and every promise and stream in it settled. Rejects when the value fails, is cancelled, or the reader ends first. |
| `cancel(key, reason?)` | Fails what still waits in `key`, forgets it, and drops its later messages. Tell the writer to cancel it too, if it can hear. |
| `end(reason?)` | Fails every value that has not arrived, and every promise and stream that still waits. |

The reader keeps each value until you `cancel` its key, so `get` returns the same value every time. On a connection that stays open, cancel each key once you are done with its value:

```js
const user = await reader.get('user');
await reader.settled('user');
reader.cancel('user');
```

`createJSONReader` takes the options of [`createCrossDeserializer`](./streaming.md#receiving-a-json-stream), and `sharedRefs`. Pass the same `plugins` to the writer and the reader.

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

## `fromWebStream`, `fromResponse` and `fromNodeStream` options

| Option | Description |
| --- | --- |
| `maxFrameSize` | Refuses any frame larger than this many bytes. Defaults to 64MiB. |
| `signal` | An `AbortSignal`. Aborting it stops reading and ends the reader with the abort reason. |
| `onError(error)` | Receives an error of the stream, such as a malformed frame or a dropped connection. The reader also ends with it. |

`fromWebStream` ends the reader when the stream ends, and its promise never rejects.

## Errors

Values fail with `SerovalTransportError` when:

- the writer failed or cancelled them.
- the reader ended before they arrived or settled.
- a frame header or a message is malformed.
- a frame is larger than `maxFrameSize`.

## Message format

| Message | Meaning |
| --- | --- |
| `[0, key, data]` | The next piece of a value. The first one for a key starts it. `data` is a `SerovalNode` in JSON format, and code in the code format. |
| `[1, key]` | The value and everything in it settled. |
| `[2, key]` | The writer failed or cancelled the value. |

`toWebStream` sends each message as JSON in a frame: a 12-byte header followed by the UTF-8 data. The header holds the data size as 8 hex digits. `@seroval/transport/frame` exports the encoder and decoder, for other connections that carry bytes.

```
;0x00000017;[0,"0",{"t":1,"s":"a"}]
```

The header is the one that SolidStart uses for server functions, but the data is a transport message, so a SolidStart reader cannot read these frames.

## Frames

`encodeFrame(message)` returns the header and the data of one frame. Send both, in order. `createFrameDecoder` takes bytes in chunks of any size and passes on each message it completes:

```js
import { createFrameDecoder, encodeFrame } from '@seroval/transport/frame';

// writer side
const writer = createJSONWriter({
  send(message) {
    for (const bytes of encodeFrame(message)) {
      socket.send(bytes);
    }
  },
});

// reader side
socket.binaryType = 'arraybuffer';
const decoder = createFrameDecoder({ onMessage: (message) => reader.push(message) });
socket.onmessage = (event) => decoder.push(new Uint8Array(event.data));
socket.onclose = () => {
  decoder.end();
  reader.end();
};
```

| Option | Description |
| --- | --- |
| `onMessage(message)` | Receives each message, parsed but not checked. `reader.push` checks it. |
| `maxFrameSize` | Refuses any frame larger than this many bytes. Defaults to 64MiB. |

`push` and `end` throw a `SerovalTransportError` on a malformed or oversized frame, and `end` throws when the bytes stop inside a frame. End the reader with that error then.
