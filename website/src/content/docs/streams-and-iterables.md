---
title: Streams and iterables
description: Send iterables, async iterables, seroval streams and live streams with backpressure.
---

A promise settles once. To send several values over time, use an async iterable or one of seroval's streams.

## Iterables

An object with `Symbol.iterator` is sent with its values, read when it is serialized. On the receiving side, iterating the copy yields the same values.

```js
import { deserialize, serialize } from 'seroval';

const source = {
  *[Symbol.iterator]() {
    yield 1;
    yield 2;
  },
};

const copy = deserialize(serialize(source));
[...copy]; // [1, 2]
```

The copy is a new object that yields the recorded values. It does not run the original generator again.

## Async iterables

An object with `Symbol.asyncIterator` is sent as a stream of its values:

- The async functions read the iterable until it ends, then send all its values.
- The streaming functions send each value as soon as the iterable yields it.
- `serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` cannot wait, so they throw a `SerovalParserError` whose cause is a `SerovalUnsupportedTypeError`.

The copy is an async iterable you can read with `for await`.

## createStream

`createStream` creates a stream that you push values into. It keeps every value it receives, and each listener first gets the values sent so far, then new ones as they arrive.

```js
import { createStream } from 'seroval';

const stream = createStream();

stream.next('a');
stream.next('b');

stream.on({
  next(value) {
    console.log('next', value);
  },
  throw(error) {
    console.log('throw', error);
  },
  return(value) {
    console.log('return', value);
  },
});
// next a
// next b

stream.return('done');
// return done
```

| Method | Description |
| --- | --- |
| `next(value)` | Sends a value. |
| `throw(error)` | Ends the stream with an error. |
| `return(value)` | Ends the stream with a final value. |
| `on(listener)` | Adds a listener and returns a function that removes it. |

A stream ends after `throw` or `return`. Later calls do nothing.

With `crossSerializeStream`, each call to the stream becomes one chunk:

```js
// Chunk 1 creates the stream (shortened)
$R[0]=($R[1]=…)()
// Then one chunk per event
$R[0].next("a")
$R[0].next("b")
$R[0].return("done")
```

`serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` cannot wait for new events. They send a stream that has ended with all its events, and throw for a stream that is still open.

`isStream(value)` tells whether a value is a seroval stream.

## Live streams

A stream from `createStream` keeps every value it has sent, so memory grows with the length of the stream. For long or unbounded streams, use a live stream instead. A live stream:

- has one reader;
- holds at most one value at a time;
- waits for the reader to accept each value before the producer can send the next one.

```js
import { createLiveStream, crossSerializeStream } from 'seroval';

const { stream, producer } = createLiveStream({
  onCancel(reason) {
    // The reader stopped. Stop producing.
  },
});

crossSerializeStream({ events: stream }, {
  onSerialize(chunk) {
    // A WritableStream writer returns a promise, which applies backpressure.
    return writer.write(chunk);
  },
});

for await (const event of source) {
  // Resolves once the chunk for this event was accepted.
  await producer.write(event);
}
await producer.close('done');
```

The producer has three methods. Each returns a promise that resolves once the reader accepts the event:

| Method | Description |
| --- | --- |
| `write(value)` | Sends a value. |
| `close(value)` | Ends the stream with a final value. |
| `fail(error)` | Ends the stream with an error. |

They reject with a `SerovalLiveStreamError` if called while an earlier event is still waiting (`reason: 'pending'`), or after the stream has ended (`reason: 'closed'`). After a cancel, they reject with the cancel reason.

On the receiving side, a live stream keeps the values it receives only until the first listener subscribes, then passes each value on without storing it. A second listener throws, because the earlier values are gone.

To read a live stream in your own code instead of serializing it, call `stream.consume()`. The consumer's `read()` returns `{ event, accept }`. Call `accept()` once you have handled the event, so the producer can continue. `cancel(reason)` stops the stream and calls `onCancel`.

`isLiveStream(value)` tells whether a value is a live stream.

## Support by mode

| | `serialize`, `toJSON` | async functions | streaming functions |
| --- | --- | --- | --- |
| Iterable | All values | All values | All values |
| Async iterable | Throws | All values, once it ends | Each value as it arrives |
| `createStream` | All events if it has ended, otherwise throws | All values, once it ends | Each event as it happens |
| Live stream | Throws | All values, once it ends | Each event, with backpressure |

The async functions wait for the stream to end. A stream that never ends makes them wait forever.
