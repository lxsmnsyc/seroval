---
'seroval': minor
'seroval-plugins': minor
---

Add binary mode, exported as the `binary` namespace. `binary.serialize` streams a value as `Uint8Array` chunks, and `binary.deserialize` rebuilds it from those chunks without evaluating code. It supports the same types as the other modes, references shared between payloads through `binary.createReferenceMap()`, live streams and isomorphic references. Plugins support it through a `binary` section, and every plugin in `seroval-plugins/web` has one.
