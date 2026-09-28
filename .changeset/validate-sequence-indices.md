---
"seroval": patch
---

Validate a sequence node's throw and done indices during `fromJSON` and `fromCrossJSON` deserialization. Each must be an integer from -1 up to the last element index. A malformed index could previously produce an iterator that never finishes.
