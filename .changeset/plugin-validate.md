---
'seroval': minor
---

Add the optional `validate` plugin field and the `v` validators. `validate` lists a validator for each field of a plugin's node. When `deserialize` reads a listed field with `ctx.deserialize`, the decoded value is checked first, and `SerovalPluginValidationError` is thrown if it fails. It applies to `fromJSON`, `fromCrossJSON` and `createCrossDeserializer`. The validators are exported as `v` from `seroval`, and as a module from `seroval/validator`.
