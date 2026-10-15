---
'seroval': minor
'seroval-plugins': minor
---

Add plugin context hooks for parsing an async iterable as a stream source. Use them in the ReadableStream plugin to avoid a separate live-stream producer while keeping backpressure, cancellation, and wire format intact. Upgrade both packages together because the plugin requires the new core hooks.
