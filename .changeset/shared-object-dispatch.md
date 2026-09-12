---
'seroval': patch
---

Classify objects once in a shared `getObjectKind` helper so the sync, stream and async parsers no longer carry separate copies of the class checks and feature gates.
