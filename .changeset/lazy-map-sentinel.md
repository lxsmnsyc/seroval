---
'seroval': patch
---

`serialize` and `serializeAsync` no longer add an unused placeholder variable to every payload that contains a `Map`. It is now declared only when a `Map` entry needs it, so a plain `Map` serializes to `new Map([...])`.
