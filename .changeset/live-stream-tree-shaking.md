---
'seroval': patch
---

Bundles that never create a live stream no longer include the `LiveStream` class: about 570 bytes gzipped less for `toJSONAsync`, `fromJSON` or `fromCrossJSON` on the production ESM build, measured with seroval's bundle size report. An object made with `Object.create(LiveStream.prototype)` is no longer treated as a live stream.
