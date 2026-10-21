---
'seroval': patch
---

Streaming serializers reuse one plugin context per depth, so values handled by plugins no longer allocate a new context each.
