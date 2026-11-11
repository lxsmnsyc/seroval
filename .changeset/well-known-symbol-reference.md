---
'seroval': patch
---

`fromJSON` and `fromCrossJSON` now decode a well-known symbol that appears more than once in a value. The second use used to become `undefined`, or failed as a malformed node when it was an object key. A value with two iterables or async iterables, such as `[gen1, gen2]`, hit this.
