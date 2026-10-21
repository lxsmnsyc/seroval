---
'seroval': patch
---

Skip the escape loop for strings that need no escaping, escape the rest by switching on `charCodeAt`, and decode escapes without a per-match `replace` callback.
