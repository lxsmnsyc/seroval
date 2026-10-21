---
'seroval': patch
---

Back `LiveStream` with a class and check its identity with `instanceof`, like `Stream` and `Sequence`. Plain data with a `__SEROVAL_STREAM__: 2` key is no longer treated as a live stream, and live streams no longer carry that key. `Stream`, `Sequence` and `LiveStream` are now exported as classes so bundlers can drop them when unused.
