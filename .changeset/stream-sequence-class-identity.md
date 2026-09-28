---
"seroval": patch
---

Back the internal `Stream` and `Sequence` types with real classes and check their identity with `instanceof` instead of a marker property. Untrusted input can no longer forge a stream or sequence by copying a `__SEROVAL_STREAM__` or `__SEROVAL_SEQUENCE__` key. A stream or sequence read back through the eval-based `deserialize` is a plain object rather than a class instance, so re-serializing that value no longer detects it as a stream or sequence.
