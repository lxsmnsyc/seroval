---
'seroval': patch
---

Share the parser's marked reference set with serializer contexts instead of copying it, so streaming serializers no longer pay O(references) per emitted node.
