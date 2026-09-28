---
"seroval": patch
---

Reject functions that carry a `then` method as promise values during `fromJSON` and `fromCrossJSON` deserialization, the same as thenable objects.
