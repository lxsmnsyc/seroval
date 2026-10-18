---
'seroval': patch
---

Replace internal plugin context wrapper classes with plain objects so Rspack and webpack can tree-shake unused parser, serializer, and deserializer modules.
