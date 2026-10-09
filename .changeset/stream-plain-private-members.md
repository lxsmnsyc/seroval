---
'seroval': patch
---

Use TypeScript `private` members in the internal `Stream` class instead of `#` private fields. Builds that target older Node.js versions no longer convert each field access into a helper function call.
