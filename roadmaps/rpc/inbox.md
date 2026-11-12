# Inbox

- `transfer(value)` for `@seroval/rpc/post-message` (from rpc-endpoint, 2026-11-11). JSON mode serializes buffers into the message, so a buffer never reaches `postMessage` as is. It needs a seroval plugin that keeps the buffer in the value and a transfer list from the writer. Removed from the API until then. Priority: later, until a consumer asks.
- Bound the queue of calls that wait for `serve` (from rpc-endpoint). Decide in rpc-docs.
- Two streams in one value (`[g1, g2]`) fail with `Malformed node type "4"` on release/1.9.0 (from rpc-streaming, 2026-11-11). Outside rpc: reproduce it in seroval or transport and fix it in its own pull request. Until then "several streams share one window" and "cancel only when all streams ended" are untested.
