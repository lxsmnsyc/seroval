---
"@seroval/transport": minor
---

Add `@seroval/transport`, which sends a streamed value as a `ReadableStream<Uint8Array>` and reads it back.

- `toJSONStream` and `fromJSONStream` use cross-reference JSON. `toJSStream` and `fromJSStream` use code that the reader runs with `eval`.
- The writer holds back frames while the reader is slow, and cancelling the stream stops every source.
- The reader fails pending values when the stream ends early, and refuses frames larger than `maxFrameSize`.
