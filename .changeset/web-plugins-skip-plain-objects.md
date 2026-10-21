---
'seroval-plugins': patch
---

The web plugins that match instances of a built-in class, such as `URL`, `Blob` and `Headers`, now set `skipPlainObjects`. With a seroval version that supports it, serializing plain objects with these plugins is faster.
