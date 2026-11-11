---
title: Streaming
description: Send each part of a value as soon as it is ready, with crossSerializeStream, toCrossJSONStream and Serializer.
---

The async functions wait for every promise before they return anything. Streaming sends the parts that are ready right away, then sends each promise result or stream event as it happens. The receiver can start using the value before the slow parts arrive.

This page covers the string and JSON streams. To stream bytes instead, see [Binary mode](./binary-mode.md).

## crossSerializeStream

`crossSerializeStream` calls `onSerialize` once with the synchronous part of the value, then once more for every update. Each call receives a [cross-reference](./cross-reference.md) script.

```js
import { crossSerializeStream } from 'seroval';

crossSerializeStream(
  { user: 'Ada', posts: fetchPosts() },
  {
    onSerialize(chunk, initial) {
      console.log(initial, chunk);
    },
    onDone() {
      console.log('done');
    },
    onError(error) {
      console.error(error);
    },
  },
);
```

This logs two chunks. The first one, with `initial` set to `true`, holds the object and a pending promise. The second one resolves the promise once `fetchPosts()` settles. Both are shortened here:

```js
// initial: true
($R[0]={user:"Ada",posts:$R[1]=($R[2]=…)().p})

// initial: false
($R[5]=…)($R[2],$R[4]=["Hello","World"])
```

### Sending chunks to a page

The receiving page needs `$R` before the first chunk runs. Send the [header](./cross-reference.md#declaring-r) first, then each chunk in a `<script>` tag:

```js
response.write(`<script>${getCrossReferenceHeader()}</script>`);

crossSerializeStream(data, {
  onSerialize(chunk, initial) {
    // The initial chunk is an expression that evaluates to the value.
    const script = initial ? `window.DATA=${chunk}` : chunk;
    response.write(`<script>${script}</script>`);
  },
  onDone() {
    response.end();
  },
});
```

### Options

`crossSerializeStream` takes the options of [`crossSerialize`](./cross-reference.md#functions), including `refs` and `scopeId`, plus:

| Option | Description |
| --- | --- |
| `onSerialize(chunk, initial)` | Required. Receives each chunk. `initial` is `true` for the first one. |
| `onDone()` | Runs once every promise and stream has settled and every chunk was accepted. |
| `onError(error)` | Runs when a value fails to serialize. Without it, the error is thrown. |

### Backpressure

If `onSerialize` returns a promise, seroval holds back the next chunk until that promise settles. Return the promise from your transport's write to keep a slow connection from buffering without limit.

```js
crossSerializeStream(data, {
  onSerialize(chunk) {
    return writer.write(`<script>${chunk}</script>`);
  },
});
```

With a [live stream](./streams-and-iterables.md#live-streams), the held-back chunk also pauses the producer, so backpressure reaches the source.

### Stopping a stream

`crossSerializeStream` returns a function that stops the stream. Call it when the client disconnects.

```js
const stop = crossSerializeStream(data, options);

request.signal.addEventListener('abort', () => stop());
```

Stopping cancels every source that is still running: it unsubscribes from streams, cancels live streams and returns async iterators. It sends no more chunks and does not call `onDone`, so close your own transport when you stop.

## Streaming JSON

`toCrossJSONStream` works like `crossSerializeStream`, but it emits JSON nodes through `onParse(node, initial)` instead of scripts. Use it when the receiver must not evaluate code.

```js
import { toCrossJSONStream } from 'seroval';

toCrossJSONStream(data, {
  onParse(node, initial) {
    socket.send(JSON.stringify(node));
  },
  onDone() {
    socket.send('done');
  },
});
```

### Receiving a JSON stream

`createCrossDeserializer` decodes the nodes of one stream. It keeps the shared references between nodes, and it counts the promises and streams that are still waiting for a later node.

```js
import { createCrossDeserializer } from 'seroval';

const session = createCrossDeserializer({ plugins });
let value;

socket.onmessage = event => {
  if (event.data === 'done') {
    return;
  }
  const result = session.deserialize(JSON.parse(event.data));
  // The first node is the value. Later nodes update it.
  value ??= result;
};

socket.onerror = error => {
  // Rejects pending promises and ends open streams with the error.
  session.abort(error);
};

socket.onclose = () => {
  if (session.pending > 0) {
    session.abort(new Error('The stream ended before every value settled.'));
  }
};
```

The session object has:

| Member | Description |
| --- | --- |
| `deserialize(node)` | Decodes one node. Throws `SerovalAbortedError` after `abort`. |
| `pending` | The number of promises and streams that have not settled yet. |
| `abort(reason)` | Rejects every pending promise and throws `reason` into every open stream. Calling it again does nothing. |

`createCrossDeserializer` takes the options of [`fromCrossJSON`](./cross-reference.md#decoding-cross-reference-json). Values produced by a plugin are not tracked, so a plugin that returns its own promise must settle it itself.

## The Serializer class

`Serializer` writes many values to one page under named keys. Every value shares one set of references, so a later value can refer to an earlier one.

```js
import { getCrossReferenceHeader, Serializer } from 'seroval';

response.write(`<script>${getCrossReferenceHeader()};self.values={}</script>`);

const serializer = new Serializer({
  globalIdentifier: 'values',
  onData(chunk) {
    response.write(`<script>${chunk}</script>`);
  },
  onError(error) {
    console.error(error);
  },
  onDone() {
    response.end();
  },
});

serializer.write('user', { name: 'Ada' });
serializer.write('posts', fetchPosts());
serializer.flush();
```

The first chunk of each write assigns the value to the global object, for example `values["user"]=($R[0]={name:"Ada"})`. Later chunks settle its promises and streams.

| Option | Description |
| --- | --- |
| `globalIdentifier` | Required. The name of a global object that holds the values. You must create it on the page. |
| `onData(chunk)` | Required. Receives each chunk. |
| `onError(error)` | Required. Runs once for each write that fails. Other writes continue. |
| `onDone()` | Runs once, after `flush` when every write has settled, or after `close`. |
| `scopeId`, `plugins`, `disabledFeatures`, `depthLimit`, `compactArrayBufferViews` | The same as for [`crossSerializeStream`](#options). |

| Method | Description |
| --- | --- |
| `write(key, value)` | Starts sending `value` as `globalIdentifier[key]`. |
| `push(value)` | Writes `value` under the next numeric key, and returns the key. |
| `flush()` | Accepts no more writes, and calls `onDone` once every write settles. |
| `close()` | Stops every write right away, then calls `onDone`. |

The `Serializer` never sends the `$R` header or creates the global object. Send both before the first chunk.
