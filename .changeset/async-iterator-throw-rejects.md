---
'seroval': patch
---

A deserialized async iterable now rejects the promise returned by `next()` when its stream has already ended with an error. It used to throw synchronously instead.
