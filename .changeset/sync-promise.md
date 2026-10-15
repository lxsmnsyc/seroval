---
'seroval': patch
---

`toJSON`, `crossSerialize` and `toCrossJSON` now throw when the value contains a promise, like `serialize` already did. Before, they sent a promise that never settled. Use an async or streaming function to send promises.
