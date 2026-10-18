---
'seroval': patch
---

Name a typed array's constructor from the array's internal type instead of `value.constructor.name`. An own `constructor` property on a typed array could put arbitrary code into the output of `serialize`, `crossSerialize` and the streaming functions.
