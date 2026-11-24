# Log: errors-malformed-detail

- Branch feat/errors-malformed-detail from origin/release/1.9.0. Nothing existed yet.
- Real site count: 17 malformed (all deserializer.ts), 8 unsupported (5 serializer.ts, 3 deserializer.ts).
- Added `detail` to `SerovalUnsupportedNodeError`, SRV002 gets `nodeId` and `detail`; both messages built by one `describeNode` in the catalog.
- Test feeds a broken node to each site (cross JSON, plugins for the thenable and payload sites, `compileJSON` for the serializer).
