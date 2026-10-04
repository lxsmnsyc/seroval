---
'seroval': minor
---

Add a `seroval/tree` export and publish one file per module, so an app that reads cross-reference payloads at startup can load the serializer later with `import('seroval/tree')` and ship less code in its first chunk.
