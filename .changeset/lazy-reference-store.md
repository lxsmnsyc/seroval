---
'seroval': patch
---

Define the global `__SEROVAL_REFS__` store on the first `createReference` call instead of at import time, and mark the package side-effect free so bundlers can drop unused modules.
