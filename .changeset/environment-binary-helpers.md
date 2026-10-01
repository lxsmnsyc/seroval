---
'seroval': patch
---

Keep binary helpers internal to the main bundles instead of requiring package `imports` resolution. Browser export conditions reuse the existing main entry points, preserving constructor and reference-store identities without requiring changes in older bundlers or React Native resolvers. Retain runtime Buffer detection, validation, wire format and backing-buffer semantics; omit the browser-only bundle-size optimization.
