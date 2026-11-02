# @seroval/transport (origin/feat/transport) vs what rpc needs

Measured: wc -l of src on the branch: write 321, read 424, frame 179, message 38, index 2 = 964. Tests: 466 lines, 31 cases.

| rpc needs | transport has | verdict |
| --- | --- | --- |
| one seroval stream per call argument list and per result | writer.write(key, value) / reader.get(key) / push(message), one cross stream per key, refs per key, freed at done | reuse |
| messages are plain postMessage-able arrays | [0,key,data] [1,key] [2,key] | reuse, wrap in an envelope for control messages |
| cancel a stream | writer.cancel(key) sends FAIL; reader.cancel(key) drops locally, "tell the writer to cancel too" | partly: reader-to-writer direction has no message |
| fail everything on close | writer.close(reason) FAIL for each key; reader.end(reason) | reuse for stop-sent-streams and fail-read-streams steps |
| backpressure | send() may return a promise; toWebStream returns one when its queue is full. A postMessage sink returns void, so nothing slows the source | NOT enough for a worker or socket: needs credit messages from the reader (rpc-streaming) |
| call correlation, method name, notify, even/odd ids, hello and version | none | rpc adds |
| channels inside values, close(c) message, close order, onClose | none; plugins option on writer and reader could carry a channel plugin | rpc adds |
| both directions in one connection | one direction per writer/reader pair | rpc pairs one writer and one reader per endpoint, keys prefixed by role |
| byte frames for fetch bodies | frame.ts, toWebStream, fromWebStream (179 lines + part of write) | not used by rpc |

Reusable lines: write.ts + read.ts + message.ts = 783 of 964 (81%).
Not reusable: frame.ts 179 and the web stream part of write.ts.
