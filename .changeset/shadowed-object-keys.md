---
"seroval": patch
---

Keep two round-trip cases intact. An object whose own `constructor` key holds a falsy value, such as `{ constructor: undefined }`, now keeps `Object.prototype` instead of coming back with a null prototype. A null-prototype object with an own `__proto__` key, or any object serialized with `Feature.ObjectAssign` disabled, no longer turns equal-looking values such as two `new Set()` into one shared object in `serialize`, `crossSerialize` and `compileJSON` output.
