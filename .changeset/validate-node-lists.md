---
"seroval": patch
---

Validate that a node's element list is a genuine array during `fromJSON` and `fromCrossJSON` deserialization, rejecting malformed input where the list is replaced by an array-like object.
