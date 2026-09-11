---
'seroval': patch
---

Preserve reserved own property names in cyclic objects and retain Error `__proto__` data properties without changing their prototypes.

Compatibility note: Error `__proto__` fields previously dropped are now preserved as own data properties. Copying these results with `Object.assign({}, value)` can change the destination's prototype. Use `{ ...value }` for shallow copies; later merges still require safe handling.
