---
'seroval': patch
---

Fix a Map that holds itself and also contains another Map. The output could add an extra `undefined` entry to the outer Map, because the placeholder entry was written before its value was declared.
