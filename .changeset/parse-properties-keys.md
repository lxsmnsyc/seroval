---
'seroval': patch
---

Walk object properties with Object.keys instead of Object.entries so parsing no longer allocates a key/value pair per property.
