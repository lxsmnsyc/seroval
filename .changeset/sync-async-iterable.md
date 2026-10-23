---
"seroval": patch
"seroval-plugins": patch
---

`serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` now throw when the value contains an async iterable or a `ReadableStream`, as they do for a promise. Before, they sent a stream that never got its values. Use an async or streaming function to send them.
