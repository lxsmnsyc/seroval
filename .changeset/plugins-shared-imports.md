---
'seroval-plugins': patch
---

The web plugins import from `seroval/shared` instead of `seroval`, so a bundle that only reads or only writes does not pull in the other side through them.
