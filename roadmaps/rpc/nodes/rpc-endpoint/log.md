# Log: rpc-endpoint

- Port shape: `Port { send, onMessage, onError?, onClose?, close? }` in `src/endpoint.ts`. `onClose` is an addition: a worker `exit` or port `close` fails calls in flight.
- Error flag: a failed result is `[callKey, {name, message}, 1]`. A call is told from a result by `typeof value[0]` (number is a channel ID, string is a call key).
- `notify` flag: a call carries a fourth element `1`. The contract says "same shape", but the callee needs to know no result is wanted.
- New keys: the peer's writer opens keys in order, so a key at or above `nextKey` is new; the endpoint then calls `reader.get` and `reader.settled` so the reader frees the slot. This also covers a value that fails before its first message.
- Result keys: results go through the same `push()` writer as calls, so no `written` Set grows (the spike's concern).
- Serialization failure: the writer's `onError` fires inside `push`; the endpoint rejects the call or sends a failure result. A later failure (a stream) is not reported.
- `initiator` is unused: call IDs are transport keys. Kept in `EndpointOptions` per the contract.
- Dead end: a `transfer` that works. JSON mode copies buffers into nodes, so the original never reaches `postMessage`. Needs a plugin (rpc-channels or later).
- Test pair first lost hello on sync delivery; fixed by buffering until a listener attaches, like a MessagePort.
- Held calls (before hello) rejected with RpcClosedError even when the transport failed; fixed with `stopReason`.
