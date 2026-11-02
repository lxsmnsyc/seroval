---
"@seroval/transport": minor
---

Add `@seroval/transport`, which sends many streamed values over one connection, such as a `fetch` body, a WebSocket or a `MessagePort`.

- `createJSONWriter` sends each value under a key as messages, and `createJSONReader` reads them back with `get(key)`. `createJSWriter` and `createJSReader` send code that the reader runs with `eval`.
- `toJSONStream` and `fromJSONStream` send a single value.
- `@seroval/transport/web` exports `toWebStream`, which turns the messages into a `ReadableStream<Uint8Array>` of length-prefixed frames, and `fromWebStream`, which reads them back. `toResponse` and `fromResponse` do the same with a `Response`. `@seroval/transport` does not export them.
- Each value has its own references by default, which are freed when it is done. `sharedRefs` shares them across values.
- `send` can return a promise to hold back the next message. Either side can cancel one value, and the reader fails what still waits when it ends.
- `reader.settled(key)` resolves once everything in a value settled. `reader.cancel(key)` frees a value the reader no longer needs.
- The `signal` option closes a writer when it aborts.
- `@seroval/transport/node` exports `toNodeStream` and `fromNodeStream`, which do the same with a Node `Readable`.
- `@seroval/transport/frame` exports `encodeFrame` and `createFrameDecoder`, for other connections that carry bytes.
