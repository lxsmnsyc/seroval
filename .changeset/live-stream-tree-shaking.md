---
'seroval': patch
---

Bundles that never create a live stream no longer include the `LiveStream` class, which saves about 580 bytes gzipped in code that uses `toJSONAsync`, `fromJSON` or `fromCrossJSON`. An object made with `Object.create(LiveStream.prototype)` is no longer treated as a live stream.
