---
'seroval-plugins': patch
---

Throw coded seroval errors for the two remaining plain throws in the web plugins. A value shared between plugin values now throws `SerovalPluginValidationError` (`SRV013`) with the plugin tag and field, and deserializing `AbortControllerFactoryPlugin` directly throws `SerovalMalformedNodeError` (`SRV008`). The `code` field needs seroval 1.9.0; the peer range stays `^1.8.0`.
