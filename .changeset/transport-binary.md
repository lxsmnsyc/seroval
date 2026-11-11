---
'@seroval/transport': minor
---

Add `@seroval/transport/binary`, which sends values in seroval's binary mode. `createBinaryWriter` and `createBinaryReader` send the bytes of each value as the data of a message, and `encodeFrame`, `toWebStream` and `toNodeStream` put those bytes in a frame without JSON. The frame decoder reads both kinds of frames. It needs seroval 1.9 or later.
