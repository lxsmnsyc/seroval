---
"seroval": patch
---

Keep each internal `Stream` instance's state in one private record. The buffer and the listener list are allocated on first use, and the listener list is released when the stream ends.
