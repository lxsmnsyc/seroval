---
'seroval-plugins': patch
---

The web plugins check their fields with `validate`. A field with the wrong type now throws `SerovalPluginValidationError`, as the `cause` of the decoding error. The ReadableStream plugin now also checks that its source is a stream. `seroval-plugins` now needs `seroval` 1.8.0 or newer.
