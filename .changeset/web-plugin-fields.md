---
'seroval-plugins': patch
---

Check the File, ImageData, Event and CustomEvent fields during deserialization. The options of each are checked field by field and copied, and ImageData's data must be a `Uint8ClampedArray`.
