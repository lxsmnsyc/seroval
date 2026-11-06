---
'seroval': patch
---

Fix several parser edge cases:

- The async parser no longer leaves a rejecting promise unhandled while an earlier sibling is still pending.
- The stream parser removes queued records in constant time, so a consumer that applies backpressure no longer makes emission quadratic.
- A failed parse no longer leaves ids in a caller-owned `refs` map, so later calls and `Serializer` writes define those values again.
- The stream parser counts only the first settlement of a promise whose `then` calls back more than once.
- Arrays with more than 1,000,000 holes are rejected with a `SerovalParserError` instead of exhausting memory.
- `Buffer` and other typed array subclasses serialize as their base typed array, and the typed array size limit applies to them.
