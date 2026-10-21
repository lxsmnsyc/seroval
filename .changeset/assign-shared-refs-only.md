---
'seroval': minor
---

Add the `assignSharedRefsOnly` option to `crossSerialize` and `crossSerializeAsync`. It stores only the values the output reads more than once in `$R`, which makes shorter output when no later script refers back to it.
