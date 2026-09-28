---
"seroval": patch
---

Stop reading an iterable at the first error thrown by its `next()` during serialization. An iterator that always threw previously made serialization loop forever.
