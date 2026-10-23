---
"seroval": patch
---

`serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` now send a `createStream` stream that has ended with all its events. A stream that is still open, or a live stream, now throws. Before, they sent an empty stream that never ended.
