---
'seroval': patch
---

Skip the escape loop for strings that need no escaping, decode escapes without a per-match `replace` callback, and drive both directions from one escape table.
