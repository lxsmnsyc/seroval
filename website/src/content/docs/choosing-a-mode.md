---
title: Choosing a mode
description: Pick the right function for your data, your transport and your trust level.
---

seroval has one function for each combination of output format and timing. Start with two questions:

1. **Does the receiver trust the sender?** If not, use the JSON functions, and decode with `fromJSON` or `fromCrossJSON`. Never evaluate JavaScript output from a source you do not trust.
2. **Does the value contain promises or streams?** If so, use an async or streaming function.

## All functions

| | JavaScript output | JSON output |
| --- | --- | --- |
| Sync values | `serialize` | `toJSON` |
| Async values, one result | `serializeAsync` | `toJSONAsync` |
| Shared references, sync | `crossSerialize` | `toCrossJSON` |
| Shared references, async | `crossSerializeAsync` | `toCrossJSONAsync` |
| Streaming | `crossSerializeStream` | `toCrossJSONStream` |
| Decoding | `deserialize` (runs the code) | `fromJSON`, `fromCrossJSON` |

The `Serializer` class wraps `crossSerializeStream` for apps that write many values to one page. See [Streaming](./streaming.md#the-serializer-class).

## JavaScript or JSON?

**JavaScript output** is smaller and needs no decoder: the browser runs it directly. Use it when the server sends data to its own pages, such as server-rendered HTML.

**JSON output** is larger, but decoding it runs no code from the sender. Use it when the receiver cannot trust the sender. The usual case is a server that reads a request body from a client.

## One result or a stream?

**`serialize` and `toJSON`** handle synchronous values only. They cannot wait, so a promise in the value throws an error.

**The async functions** wait until every promise settles and every stream ends, then return one result. They are simple to use, but the receiver waits for the slowest value. A stream that never ends makes them wait forever.

**The streaming functions** send what is ready right away, then send each promise or stream event as it happens. Use them when parts of the value are slow, or when the value includes a stream.

## Isolated or shared references?

**`serialize` and `toJSON`** output is self-contained. Each result rebuilds its own copy of every value.

**The cross-reference functions** store each value in a shared array, `$R`, and keep a `refs` map of what they have sent. A later call with the same `refs` map refers back to values an earlier call already sent, instead of sending them again. Streaming is built on this. See [Cross-reference serialization](./cross-reference.md).

## Common setups

| You want to | Use |
| --- | --- |
| Embed state in a server-rendered page | `serialize` or `serializeAsync` |
| Stream state into the page as it loads | `crossSerializeStream` or `Serializer` |
| Send a request body from client to server | `toJSON`, then `fromJSON` on the server |
| Stream data to a client that must not evaluate it | `toCrossJSONStream`, then `createCrossDeserializer` |
| Store a value and load it later | `toJSON` and `fromJSON` |
