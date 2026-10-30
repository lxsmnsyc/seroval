---
"seroval-plugins": patch
---

Streamed `Request` payloads now deserialize where stream request bodies are supported. `RequestPlugin` adds `duplex: 'half'` to the request options when the body is a `ReadableStream`, which Chrome 105+ and Node 19.1+ require. Runtimes without stream request bodies ignore the option.

`RequestPlugin` also keeps the body of a `Request` in runtimes without the `Request.body` getter, such as Firefox. The async parse reads the body with `arrayBuffer()`, and the stream parse pushes that buffer into a new `ReadableStream`.
