---
'seroval': patch
---

Fix a Map that holds itself as a key or value. When the other half of that entry contained an object that was referenced more than once, the output could throw when run, or a later entry could get `undefined` in place of that object.
