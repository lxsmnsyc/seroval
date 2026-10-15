---
'seroval': patch
---

- `SerovalLiveStreamError` now has error code 12, and its production message is `Seroval Error (specific: 12)` like every other specific error. Read the `reason` property for the cause.
- Export `SerializeOptions`, `SerializeAsyncOptions`, `ToJSONOptions` and `ToJSONAsyncOptions`, the option types of `serialize`, `serializeAsync`, `toJSON` and `toJSONAsync`.
- Mark `Feature.ArrowFunction` and `SerovalMissingReferenceError` as deprecated. Neither has any effect.
