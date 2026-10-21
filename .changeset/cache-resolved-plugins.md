---
'seroval': patch
---

Reuse the resolved plugin list when the same `plugins` array is passed again, so each call no longer rebuilds it.
