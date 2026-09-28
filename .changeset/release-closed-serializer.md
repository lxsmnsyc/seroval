---
'seroval': patch
---

Release private references and cleanup callbacks when a Serializer closes, prevent reentrant completion, and finish other writes' cleanup when a callback throws.