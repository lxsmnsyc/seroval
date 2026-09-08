---
'seroval': patch
'seroval-plugins': patch
---

Drain async iterables and ReadableStreams iteratively to avoid retaining an async call chain for every streamed value.
