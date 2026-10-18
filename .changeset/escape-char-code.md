---
'seroval': patch
---

Escape strings by switching on `charCodeAt` instead of looking up `str[i]` in the escape table.
