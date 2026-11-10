---
'@seroval/transport': patch
---

The blob and form data plugins of `toFormData` and `fromFormData` now check their fields with plugin validators. A tampered field throws `SerovalPluginValidationError`, as the cause of the `SerovalDeserializationError` that `fromFormData` throws, instead of `SerovalTransportError`.
