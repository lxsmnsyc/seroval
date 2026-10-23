---
'seroval': patch
---

Speed up binary mode. The serializer writes nodes into one buffer and sends the synchronous part of a value as one chunk. The deserializer parses each buffered node without waiting between fields.
