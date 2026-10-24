---
"seroval": patch
---

`fromJSON` and `fromCrossJSON` no longer cause unhandled rejections. A payload with a rejected promise in a field the caller never reads could stop a Node.js process. Code that awaits the promise still gets the rejection.
