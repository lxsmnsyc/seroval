---
"seroval-plugins": patch
---

Check string, number and `ArrayBuffer` fields at runtime when deserializing the URL, URLSearchParams, Request, DOMException, Event, CustomEvent, Blob, File and ImageData plugins. A field of the wrong type now throws instead of being coerced by the Web constructor.
