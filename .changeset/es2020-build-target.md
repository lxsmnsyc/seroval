---
'seroval': patch
'seroval-plugins': patch
---

Build with an explicit ES2020 syntax target so the emitted syntax floor no longer follows `engines.node`, keeping nullish coalescing and optional chaining as written.
