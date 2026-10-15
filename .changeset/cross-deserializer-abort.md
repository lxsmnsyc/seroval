---
'seroval': minor
---

Add `createCrossDeserializer`, a session for cross-reference JSON records that tracks unsettled promises and open streams, reports how many are still pending, and can abort them with a caller-supplied reason when the transport fails.
