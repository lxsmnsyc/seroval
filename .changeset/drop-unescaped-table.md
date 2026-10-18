---
'seroval': patch
---

Drop the unused `ESCAPED` and `UNESCAPED` lookup tables from `string.ts` and reuse `deserializeString` on non-primitive replacement matches.
