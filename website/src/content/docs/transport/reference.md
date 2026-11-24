---
title: Transport reference
description: Every method and option of the @seroval/transport writers, readers and stream adapters, and the errors they throw.
type: reference
---

## The writer

| Method | Description |
| --- | --- |
| `write(key, value)` | Starts sending `value` under `key`. Each key can be written once. |
| `push(value)` | Starts sending `value` under the next unused number, and returns the key. |
| `cancel(key, reason?)` | Stops one value and its sources, and tells the reader it failed. |
| `flush()` | Takes no more values, and calls `onDone` once every value is done. |
| `close(reason?)` | Stops every value, tells the reader they failed, and calls `onDone`. |

`createJSONWriter` takes the options of [`toCrossJSONStream`](../streaming.md#streaming-json), such as `plugins`, `disabledFeatures` and `depthLimit`. It also takes:

| Option | Description |
| --- | --- |
| `send(message)` | Sends one message. Return a promise to hold back the next message of the same value until it settles. |
| `onDone()` | Runs once, after `flush` when every value is done, or after `close`. |
| `onError(error, key)` | Receives an error that stopped a value, such as a value seroval cannot serialize. The reader only learns that the value failed. |
| `signal` | An `AbortSignal`. Aborting it closes the writer with the abort reason. |
| `sharedRefs` | Shares one set of references across every value. See [References](../transport.md#references). |

## The reader

| Method | Description |
| --- | --- |
| `push(message)` | Takes the next message. Throws a `SerovalTransportError` on a malformed message. End the reader with that error then. |
| `get(key)` | A promise of the value of `key`. |
| `settled(key)` | Resolves once the value of `key` and every promise and stream in it settled. Rejects when the value fails, is cancelled, or the reader ends first. |
| `cancel(key, reason?)` | Fails what still waits in `key`, forgets it, and drops its later messages. Tell the writer to cancel it too, if it can hear. |
| `end(reason?)` | Fails every value that has not arrived, and every promise and stream that still waits. |
| `size` | How many keys the reader holds. |

The reader frees a key once it settled and you called both `get` and `settled` for it. You then hold both promises, so keep them instead of calling `get` again. A later `get` of a freed key waits for a new value under that key. On a connection that stays open, request both for each key:

```js
const user = await reader.get('user');
await reader.settled('user');
```

A key that you only `get`, or never request, stays until you `cancel` it or the reader ends. The writer can send at most `maxKeys` keys that you have not requested. One more makes `push` throw a `SerovalTransportError`, so a writer cannot fill the reader's memory with values nobody reads.

| Option | Description |
| --- | --- |
| `maxKeys` | The most keys the writer can send before you request them. Defaults to 1000. |

`createJSONReader` also takes the options of [`createCrossDeserializer`](../streaming.md#receiving-a-json-stream), and `sharedRefs`. Pass the same `plugins` to the writer and the reader. `createJSReader` takes `scopeId` and `maxKeys`.

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
- the value is an object or function with a `then` function. A promise would call it.

`fromFormData` and `fromFormRequest` throw a `SerovalTransportError` when the body is not form data, or when the `seroval` field is missing or is not JSON. `fromFormRequest` also rejects a value with a `then` function. A malformed value, such as an index whose part is missing, throws the errors of `fromJSON`.

## Related

- [Transport](../transport.md)
- [Transport message format](./protocol.md)
- [Streaming](../streaming.md)
