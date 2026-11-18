---
"seroval-plugins": patch
"seroval": patch
---

Harden the binary deserializer against malformed input: cap typed array, big-int typed array, and `DataView` lengths at 1,000,000 on both serialization and deserialization, cap `ArrayBuffer` length with the `maxArrayBufferLength` option (1,000,000 bytes by default), and validate that an object property key resolves to a `String` or a well-known symbol node before it is used as a key.
