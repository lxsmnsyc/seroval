---
'seroval': minor
'seroval-plugins': minor
---

Add `createLiveStream()`, a single-consumer stream that holds one event at a time and resolves each producer write only after the serialized record is accepted. `crossSerializeStream` and `toCrossJSONStream` callbacks may now return a promise; the next record, and the acceptance of the source event behind it, wait for it to settle. Records discovered while parsing an event are emitted after the record that introduces them, one callback runs at a time, `onDone` waits for the last callback and is not called after an output failure, and cleanup runs every callback once. Async iterables and `ReadableStream` values read their next chunk only after the previous record is accepted. The streaming plugin context now exposes only `parse`; the manual `pushPendingState`, `popPendingState`, `onParse`, `onError`, `isAlive`, `parseWithError` and `addCleanup` hooks are removed in favor of parsing a live stream.
