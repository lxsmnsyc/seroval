---
'seroval': patch
---

Honor `depthLimit` in every serializer entry point and in `fromJSON`, wrap failures raised while emitting output in `SerovalSerializationError`, and report a node id that is assigned twice with `SerovalConflictedNodeIdError`.
