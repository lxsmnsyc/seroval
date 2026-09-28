---
"seroval": patch
---

Check that an iterator or async iterator's source is a genuine sequence or stream during `fromJSON` deserialization. Previously the check used the type recorded for the source's id, and an id missing from `m` could be reused to pass a plain object as the source.
