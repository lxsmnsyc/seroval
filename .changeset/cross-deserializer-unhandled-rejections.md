---
"seroval": patch
---

`createCrossDeserializer` no longer causes unhandled rejections. This covers a rejected promise that the caller never reads, and a pending promise that `abort` rejects. Code that awaits the promise still gets the rejection.
