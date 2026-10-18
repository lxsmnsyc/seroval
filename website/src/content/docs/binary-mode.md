---
title: Binary mode
description: Send values as Uint8Array chunks with binary.serialize, and decode them without running code with binary.deserialize.
---

Binary mode encodes a value as `Uint8Array` chunks instead of a string or a JSON tree. It streams like [`crossSerializeStream`](./streaming.md), and its decoder runs no code, like [`fromJSON`](./json.md). It is exported as the `binary` namespace:

```js
import { binary } from 'seroval';
```

## When to use it

Binary mode combines parts of the other modes:

- **Like the streaming functions**, it sends the synchronous part of the value right away, then one chunk for each promise result and stream event.
- **Like the JSON functions**, decoding validates the input and never evaluates it. It is built for input you do not trust.
- **Unlike both**, the output is bytes. Strings are sent as UTF-8 and `ArrayBuffer` contents as raw bytes, with no base64 step.

It also has limits:

- The receiver needs `binary.deserialize`. The output cannot run in a `<script>` tag.
- There is no one-shot form. `binary.serialize` always reports its output through callbacks, even for a value with no promises.

Use it when the transport carries bytes, such as a `fetch` body, a `ReadableStream` or a WebSocket, and the receiver must not evaluate what it gets. See [Choosing a mode](./choosing-a-mode.md) for the full comparison.

## A complete example

The sender turns a value into a `ReadableStream` of bytes. The receiver reads the bytes back into a value.

```js
import { binary } from 'seroval';

function toByteStream(value) {
  return new ReadableStream({
    start(controller) {
      binary.serialize(value, {
        refs: new Map(),
        onSerialize(bytes) {
          controller.enqueue(bytes);
        },
        onDone() {
          controller.close();
        },
        onError(error) {
          controller.error(error);
        },
      });
    },
  });
}

async function fromByteStream(stream) {
  const reader = stream.getReader();
  const { value } = await binary.deserialize({
    async read() {
      const result = await reader.read();
      // `undefined` once the stream ends.
      return result.value;
    },
    onError(error) {
      console.error(error);
    },
  });
  return value;
}
```

Send a value with a cycle and a promise:

```js
// The sender
const user = { name: 'Ada', joined: new Date('2026-01-01') };
user.self = user;

const response = new Response(
  toByteStream({
    user,
    posts: fetchPosts(),
  }),
);

// The receiver
const value = await fromByteStream(response.body);

value.user.self === value.user; // true
await value.posts; // ['Hello', 'World']
```

The first chunk holds the object and a pending promise. `fromByteStream` returns as soon as that chunk is decoded. A second chunk settles `posts` once `fetchPosts()` resolves.

## Serializing

`binary.serialize(value, options)` takes:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `refs` | `Map` | required | The values already sent. Pass a new `Map` for each payload, or share one to [send references between payloads](#sharing-references-between-payloads). |
| `onSerialize(bytes)` | function | required | Receives each `Uint8Array` chunk. It may return a promise, see [Live streams](#live-streams). |
| `onDone()` | function | required | Runs once every promise and stream has settled. |
| `onError(error)` | function | required | Runs when a value cannot be serialized. |
| `plugins` | `Plugin[]` | none | Plugins for extra types. Each one needs a [`binary` section](./writing-plugins.md#binary-mode). |
| `disabledFeatures` | `number` | `0` | [`Feature`](./compatibility.md#feature-flags) flags to turn off, combined with `\|`. |
| `features` | `number` | all features | The features to turn on, as a bit mask. Overrides `disabledFeatures`. |
| `depthLimit` | `number` | `64` | Maximum nesting depth. |

The synchronous part of the value is sent as one chunk, before `binary.serialize` returns. Each settled promise and each stream event is sent as one more chunk. A value with no promises or streams calls `onDone` before `binary.serialize` returns.

Views are always sent with their whole `ArrayBuffer`. Binary mode has no `compactArrayBufferViews` option.

### Stopping

`binary.serialize` returns a function that stops serialization. Call it when the receiver goes away.

```js
const stop = binary.serialize(value, options);

request.signal.addEventListener('abort', () => stop());
```

Stopping:

- unsubscribes from streams, cancels live streams and returns async iterators;
- runs the cleanups that plugins registered;
- sends no more chunks and does not call `onDone`.

If a cleanup throws, the first error goes to `onError`. Calling the function again does nothing.

### When serialization fails

`onError` receives the error itself, for example a `SerovalUnsupportedTypeError`. Binary mode does not wrap it in a `SerovalParserError`.

- **The root value fails.** For example, it contains a function. The bytes written so far are still sent, but they have no root, so the receiver rejects them. Sources that already started are stopped, and `onDone` is not called.
- **A later value fails.** For example, a promise resolves to a function. That result is not sent, and the rest of the value continues. `onDone` still runs. The receiver rejects the payload when the input ends, because that promise never settled.
- **A cleanup throws** after every value settled. `onError` receives the first error, and `onDone` is not called.

## Deserializing

`binary.deserialize(options)` takes:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `read()` | function | required | Returns a promise for the next chunk, or for `undefined` at the end of the input. |
| `onError(error)` | function | required | Runs when the input is invalid or a value cannot be rebuilt. |
| `refs` | `ReferenceMap` | a new map | The map from `binary.createReferenceMap()`. Share one to [resolve references between payloads](#sharing-references-between-payloads). |
| `plugins` | `Plugin[]` | none | Plugins for extra types. They need the same tags as the sender's. |
| `disabledFeatures` | `number` | `0` | Feature flags to reject. |
| `features` | `number` | all features | The features to accept, as a bit mask. Overrides `disabledFeatures`. |

It returns a promise for `{ value }`. The value is wrapped, so a root value that is a promise is handed over as is. The promise resolves as soon as the root value is decoded, with every object, array, `Map` and `Set` in it filled in. Promises and streams inside the value may still be pending.

`read` can return chunks of any size. A node may be split across chunks, and one chunk may hold many nodes.

### Untrusted input

`binary.deserialize` treats its input as untrusted:

- It never evaluates code from the input.
- It checks every node against the rules in the [binary format](./binary-format.md#validation). For example, a reference must point to a value that was already declared, with a type the node accepts.
- It defines reserved property names such as `__proto__` and `constructor` as own properties instead of assigning them.
- It rejects typed arrays longer than 1,000,000 elements, `DataView`s longer than 1,000,000 bytes and `RegExp` patterns longer than 20,000 characters.
- It rejects `RegExp` and `Temporal` values when their [feature](./compatibility.md#feature-flags) is disabled.

When the input is invalid, or when it ends before every value has settled:

- the error goes to `onError`;
- the returned promise is rejected, if it has not resolved yet;
- promises that have not settled are rejected with the error;
- streams that have not ended are thrown into with the error.

If `read()` rejects, for example because the connection dropped, the same happens with that error.

Some errors only go to `onError`, and decoding continues. This happens when one property, entry or element cannot be set, for example because a plugin fails to rebuild it. The rest of the value is still decoded without it. Treat any call to `onError` as a failed payload.

> [!NOTE]
> `binary.deserialize` limits no total size. An `ArrayBuffer` can be as large as the sender makes it, and the decoder keeps every chunk it reads until the node is complete. Limit the size of the input in your transport.

## Sharing references between payloads

Pass the same reference maps to several payloads, and a later payload can refer to values an earlier one sent, instead of sending them again. The serializer uses a `Map`, and the deserializer uses `binary.createReferenceMap()`.

```js
import { binary } from 'seroval';

// One map on each side, shared by every payload.
const serializerRefs = new Map();
const deserializerRefs = binary.createReferenceMap();

function send(value) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    binary.serialize(value, {
      refs: serializerRefs,
      onSerialize(bytes) {
        chunks.push(bytes);
      },
      onDone() {
        resolve(chunks);
      },
      onError: reject,
    });
  });
}

async function receive(chunks) {
  let index = 0;
  const { value } = await binary.deserialize({
    refs: deserializerRefs,
    async read() {
      return chunks[index++];
    },
    onError(error) {
      console.error(error);
    },
  });
  return value;
}

const user = { name: 'Ada' };

const first = await receive(await send({ user }));
const second = await receive(await send({ author: user }));

second.author === first.user; // true
```

Decode the payloads in the order they were sent, with the same pair of maps. If a payload refers to a value the receiver never decoded, `onError` receives an error such as `SerovalMissingBinaryRefError`, and the value is incomplete.

## Live streams

A [live stream](./streams-and-iterables.md#live-streams) is sent one event at a time. If `onSerialize` returns a promise, the event behind that chunk is accepted only after the promise resolves, so the producer waits for the transport. Other chunks are not held back.

```js
import { binary, createLiveStream } from 'seroval';

const { stream, producer } = createLiveStream();

binary.serialize(
  { events: stream },
  {
    refs: new Map(),
    onSerialize(bytes) {
      // A WritableStream writer returns a promise, which applies backpressure.
      return writer.write(bytes);
    },
    onDone() {
      writer.close();
    },
    onError(error) {
      writer.abort(error);
    },
  },
);

for await (const event of source) {
  // Resolves once the chunk for this event was written.
  await producer.write(event);
}
```

Stopping the serializer cancels the live stream, and its `onCancel` runs.

On the receiving side, a live stream keeps its values only until the first listener subscribes. After that, it passes values on without storing them, and a second listener throws.

## Isomorphic references

Values registered with [`createReference`](./isomorphic-references.md) are sent by their key, as in the other modes. The receiver must register a value under the same key, or decoding fails with `SerovalMissingReferenceForIdError`.

An [`OpaqueReference`](./isomorphic-references.md#opaquereference) sends its replacement, as in the other modes.

## Plugins

A plugin works in binary mode through its `binary` section. See [Writing plugins](./writing-plugins.md#binary-mode). Every plugin in [seroval-plugins](./using-plugins.md#seroval-plugins) has one.

Pass the same plugins on both sides. A value that matches a plugin with no `binary` section makes serialization fail with a `TypeError`.

## Wire format

The [binary format](./binary-format.md) page describes every node, its byte layout and the rules the decoder checks.
