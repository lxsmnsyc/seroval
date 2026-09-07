---
"seroval-plugins": minor
"seroval": minor
---

Add composable value validators for plugin authors, exported as `v` from `seroval`, plus a `SerovalPluginValidationError` thrown when a value fails one. A plugin's `deserialize` receives untrusted input, so it can validate a decoded value before using it, for example `if (!v.arrayBuffer(buffer)) throw new SerovalPluginValidationError(tag)`. The built-in `seroval-plugins/web` plugins now validate their payloads this way.
