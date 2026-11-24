# Log: errors-plugins

- Branch feat/errors-plugins from origin/release/1.9.0. The work did not exist yet.
- `claim(value, tag, field)` and `copyEntries(list, tag, field)` take tag and field from callers; 9 call sites updated.
- AbortControllerFactoryPlugin.deserialize throws SerovalMalformedNodeError(node, detail).
- Tests: shared-values.test.ts checks SRV013 and tag via cause; abort-signal.test.ts checks SRV008.
