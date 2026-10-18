---
'seroval': patch
---

Replace the `getTypedArrayConstructor` switch with an `Object.hasOwn`-guarded constructor lookup table.
