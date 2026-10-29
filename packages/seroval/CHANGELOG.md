# seroval

## 1.7.5

### Patch Changes

- d85ec3f: Keep two round-trip cases intact. An object whose own `constructor` key holds a falsy value, such as `{ constructor: undefined }`, now keeps `Object.prototype` instead of coming back with a null prototype. A null-prototype object with an own `__proto__` key, or any object serialized with `Feature.ObjectAssign` disabled, no longer turns equal-looking values such as two `new Set()` into one shared object in `serialize`, `crossSerialize` and `compileJSON` output.

## 1.7.4

No changes in this release.

## 1.7.3

### Patch Changes

- 3a60f79: Republish the 1.7.2 changes through CI with npm provenance. 1.7.2 was published manually without an attestation, so pnpm's `trustPolicy: no-downgrade` refused to install it (#278). No code changes.

## 1.7.2

### Patch Changes

- 737afa1: `fromJSON` and `fromCrossJSON` no longer cause unhandled rejections. A payload with a rejected promise in a field the caller never reads could stop a Node.js process. Code that awaits the promise still gets the rejection.

## 1.7.1

### Patch Changes

- b703710: `createCrossDeserializer` no longer causes unhandled rejections. This covers a rejected promise that the caller never reads, and a pending promise that `abort` rejects. Code that awaits the promise still gets the rejection.
- 2d03651: `serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` now throw when the value contains an async iterable or a `ReadableStream`, as they do for a promise. Before, they sent a stream that never got its values. Use an async or streaming function to send them.
- 2c25bf3: `serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` now send a `createStream` stream that has ended with all its events. A stream that is still open, or a live stream, now throws. Before, they sent an empty stream that never ended.

## 1.7.0

### Minor Changes

- 9a75aae: Add the `assignSharedRefsOnly` option to `crossSerialize` and `crossSerializeAsync`. It stores only the values the output reads more than once in `$R`, which makes shorter output when no later script refers back to it.
- f3f39de: Add `createCrossDeserializer`, a session for cross-reference JSON records that tracks unsettled promises and open streams, reports how many are still pending, and can abort them with a caller-supplied reason when the transport fails.
- 2324090: Streams serialized from a live stream in streaming mode are rebuilt with a live receiver: it keeps history only until its first listener subscribes, then forwards each value without retaining it and refuses a second listener. Replay streams and existing serialized data are unchanged, and readers that ignore the marker build a replay receiver.
- 4c0008f: Add `createLiveStream()`, a single-consumer stream that holds one event at a time and resolves each producer write only after the serialized record is accepted. `crossSerializeStream` and `toCrossJSONStream` callbacks may now return a promise; the next record, and the acceptance of the source event behind it, wait for it to settle. Records discovered while parsing an event are emitted after the record that introduces them, one callback runs at a time, `onDone` waits for the last callback and is not called after an output failure, and cleanup runs every callback once. Async iterables and `ReadableStream` values read their next chunk only after the previous record is accepted. Existing streaming plugin lifecycle hooks remain available; parsing a live stream is the preferred way to connect an incremental source.
- f2b7d0c: Raise the supported Node.js floor from `>=10` to `>=20` in `engines`, remove the no-op `typesVersions` from seroval, give seroval-plugins `main`, `module` and `types` fields plus a `typesVersions` entry that points at the emitted `web` declarations, and link the plugins package to the workspace copy of seroval.
- 8a95987: Add the optional `skipPlainObjects` plugin field. A plugin that sets it to `true` is not tested against plain objects, which makes parsing faster when most values are plain objects.
- 5ab601f: Add plugin context hooks for parsing an async iterable as a stream source. Use them in the ReadableStream plugin to avoid a separate live-stream producer while keeping backpressure, cancellation, and wire format intact. Upgrade both packages together because the plugin requires the new core hooks.

### Patch Changes

- 6d92c38: - Export `SerializeOptions`, `SerializeAsyncOptions`, `ToJSONOptions` and `ToJSONAsyncOptions`, the option types of `serialize`, `serializeAsync`, `toJSON` and `toJSONAsync`.
  - Mark `Feature.ArrowFunction` and `SerovalMissingReferenceError` as deprecated. Neither has any effect.
- 8b4214f: Reuse the resolved plugin list when the same `plugins` array is passed again, so each call no longer rebuilds it.
- b7edc16: Create leaf nodes with only their `t`, `i` and `s` fields, cutting tree memory for primitive-heavy payloads.
- dcf9a69: Report the depth limit error with its own error code.
- e118511: Derive the well-known symbol name and lookup tables and the error constructor names from their single source tables.
- 1e13e04: Avoid temporary reference lookup wrappers in the parsers and resolve named references with one registry lookup.
- c643404: The documentation moved to https://seroval.vercel.app. The READMEs and the package homepages now link to it.
- 3234e88: Honor `depthLimit` in every serializer entry point and in `fromJSON`, wrap failures raised while emitting output in `SerovalSerializationError`, and report a node id that is assigned twice with `SerovalConflictedNodeIdError`.
- a1e185a: Build with an explicit ES2020 syntax target so the emitted syntax floor no longer follows `engines.node`, keeping nullish coalescing and optional chaining as written.
- 3b49dc3: Inline feature bits inside the library with an internal `const enum`. The exported `Feature` enum is unchanged.
- d171f53: Replace the `isValidIdentifier` regex and first-character string slice with a `charCodeAt` scan.
- 641e424: `serialize` and `serializeAsync` no longer add an unused placeholder variable to every payload that contains a `Map`. It is now declared only when a `Map` entry needs it, so a plain `Map` serializes to `new Map([...])`.
- 26d263f: Define the global `__SEROVAL_REFS__` store on the first `createReference` call instead of at import time, and mark the package side-effect free so bundlers can drop unused modules.
- 20de609: Export the `Stream`, `Sequence` and `LiveStream` classes so bundlers can drop them when unused.
- f0ff974: Merge duplicated node creators, promise result and stream call handlers, and share one Temporal name table.
- bd9cac0: Skip the escape loop for strings that need no escaping, escape the rest by switching on `charCodeAt`, and decode escapes without a per-match `replace` callback.
- 5426ea8: Check extensibility first when reading object flags so ordinary objects need one native call.
- 0cb3c78: Omit trailing empty fields when creating nodes.
- 090f5be: Generate deferred assignment expressions in one pass without an intermediate array or merged assignment objects.
- 37ed929: Walk object properties with Object.keys instead of Object.entries so parsing no longer allocates a key/value pair per property.
- 11c4446: Replace internal plugin context wrapper classes with plain objects so Rspack and webpack can tree-shake unused parser, serializer, and deserializer modules.
- a758b08: Preserve reserved own property names in cyclic objects and retain Error `__proto__` data properties without changing their prototypes.

  Compatibility note: Error `__proto__` fields previously dropped are now preserved as own data properties. Copying these results with `Object.assign({}, value)` can change the destination's prototype. Use `{ ...value }` for shallow copies; later merges still require safe handling.

- 93adf62: Size parser child arrays up front, and stop awaiting primitives in the async parser.
- 96a3214: Release private references and cleanup callbacks when a Serializer closes, prevent reentrant completion, and finish other writes' cleanup when a callback throws.
- f698afa: Release stream parser subscriptions and buffered nodes after use, and complete serialization once after buffered chunks are emitted.
- e5d493e: Classify object keys with a first-character check so the serializer only parses keys that can be numeric, and emit deferred key assignments through one helper.
- 883f47f: Share the parser's marked reference set with serializer contexts instead of copying it, so streaming serializers no longer pay O(references) per emitted node.
- d1cbe82: Streaming serializers reuse one plugin context per depth, so values handled by plugins no longer allocate a new context each.
- a295de9: Classify objects once in a shared `getObjectKind` helper so the sync, stream and async parsers no longer carry separate copies of the class checks and feature gates.
- f907408: Preserve stream event order during async parsing and wait for earlier chunks before completing. Live writes are accepted after their parsed event is placed.

  Stop sources on parse or output failure, forward cancellation reasons, and release owned callbacks and records. Keep the original error when cleanup also fails, reject cleanup failures after otherwise successful parsing, and retain existing streaming plugin lifecycle hooks.

  Keep incidental primitive callback returns synchronous. Only objects and functions are inspected for thenables, and the callable `then` is invoked without reading its `call` property.

  Disposing `crossSerializeStream` or `toCrossJSONStream` no longer invokes `onDone`: disposal abandons output rather than completing it. Callers that close a response in `onDone` must also close it when disposing. `Serializer.close()` still invokes `onDone`. A failed `Serializer.write()` only stops that write; sibling streams and subsequent writes remain active. `SerializerOptions.onError` remains required.

- 258c8e3: `toJSON`, `crossSerialize` and `toCrossJSON` now throw when the value contains a promise, like `serialize` already did. Before, they sent a promise that never settled. Use an async or streaming function to send promises.
- fa4f346: Allow bundlers to remove unused iterator factories from consumers that do not need deserialization.
- 7d2153c: Keep unused symbol and constant tables out of consumer bundles and register the reference store with one global lookup.
- e70d7f6: Remove unused parser and deserializer context state and share guarded typed-array and DataView decoding.
- 5a49e1a: Unify `TypedArray` and `DataView` node creation, parsing, and serialization helpers.

## 1.6.12

### Patch Changes

- d0a7135: Preserve cyclic Map entries when deferred assignments remove placeholders, and bound generated assignment chains so large graphs can be evaluated.
- 7d052a4: Fix a Map that holds itself as a key or value. When the other half of that entry contained an object that was referenced more than once, the output could throw when run, or a later entry could get `undefined` in place of that object.
- 30398a0: Fix a Map that holds itself and also contains another Map. The output could add an extra `undefined` entry to the outer Map, because the placeholder entry was written before its value was declared.

## 1.6.11

### Patch Changes

- 1313ebb: Name a typed array's constructor from the array's internal type instead of `value.constructor.name`. An own `constructor` property on a typed array could put arbitrary code into the output of `serialize`, `crossSerialize` and the streaming functions.

## 1.6.10

### Patch Changes

- f94ee0b: Serialize a RegExp whose source contains `<` with the `RegExp` constructor, so a source such as `[</script>]` can no longer close the script element the output is embedded in.

## 1.6.9

### Patch Changes

- 5754cfd: Use TypeScript `private` members in the internal `Stream` class instead of `#` private fields. Builds that target older Node.js versions no longer convert each field access into a helper function call.

## 1.6.8

### Patch Changes

- 5d3eb6b: Reject functions that carry a `then` method as promise values during `fromJSON` and `fromCrossJSON` deserialization, the same as thenable objects.
- 15636e7: Stop reading an iterable at the first error thrown by its `next()` during serialization. An iterator that always threw previously made serialization loop forever.
- 50926b3: Check that an iterator or async iterator's source is a genuine sequence or stream during `fromJSON` deserialization. Previously the check used the type recorded for the source's id, and an id missing from `m` could be reused to pass a plain object as the source.
- 3edc78b: Back the internal `Stream` and `Sequence` types with real classes and check their identity with `instanceof` instead of a marker property. Untrusted input can no longer forge a stream or sequence by copying a `__SEROVAL_STREAM__` or `__SEROVAL_SEQUENCE__` key. A stream or sequence read back through the eval-based `deserialize` is a plain object rather than a class instance, so re-serializing that value no longer detects it as a stream or sequence.
- cdcee3e: Validate that a node's element list is a genuine array during `fromJSON` and `fromCrossJSON` deserialization, rejecting malformed input where the list is replaced by an array-like object.
- e176f92: Validate a sequence node's throw and done indices during `fromJSON` and `fromCrossJSON` deserialization. Each must be an integer from -1 up to the last element index. A malformed index could previously produce an iterator that never finishes.

## 1.6.7

### Patch Changes

- c7520ad: Skip escape replacement when decoding strings without backslashes.
- bbd75e8: Reduce JSON binary decoding time in Node while preserving base64 validation and the browser fallback.
- 772666b: Write decoded binary data directly into its output ArrayBuffer in Node, avoiding a temporary byte buffer and an additional copy.

## 1.6.6

### Patch Changes

- 0233519: Stop pulling async iterators and call their return method when streaming serialization is cancelled.
- 35f14f9: Use native base64 encoding when available. Add opt-in compact ArrayBuffer views and a configurable JSON deserialization base64 limit while preserving the existing defaults.
- 0e4e78d: Reduce the cost of escaping long strings while preserving their serialized representation.
- 7770e48: Drain async iterables and ReadableStreams iteratively to avoid retaining an async call chain for every streamed value.
- ad310d6: Keep stream listeners active when another subscription is removed, and make subscription cleanup idempotent.

## 1.6.5

### Patch Changes

- Validate the backing source of an iterator, async iterator, readable stream, and abort signal during deserialization, and export `isStream`.

## 1.6.4

### Patch Changes

- Validate the buffer source of a typed array or `DataView` during deserialization.

## 1.6.3

### Patch Changes

- fix typed array max length

## 1.6.2

### Patch Changes

- guard thenables

## 1.6.1

### Patch Changes

- f84d457: fix CJS/ESM builds

## 1.6.0

### Minor Changes

- add Temporal support

### Patch Changes

- c9dbda4: Serialized constructors now survive name-preserving bundler transforms (e.g. esbuild `keepNames`, which some platforms apply to hosted code downstream of the app's own build): every nested function in a `toString()`-serialized constructor uses method shorthand, so no bundle-scoped name helper leaks into payloads evaluated in realms that never loaded the bundle.

## 1.5.6

### Patch Changes

- fix depth limit

## 1.5.5

### Patch Changes

- serialization fixes

## 1.5.4

### Patch Changes

- fix internal type map missing in cross context

## 1.5.3

### Patch Changes

- fix deserialization internal type check

## 1.5.2

### Patch Changes

- 56a47ee: fix #74

## 1.5.1

### Patch Changes

- fix depthLimit on streaming mode

## 1.5.0

### Minor Changes

- ac27f21: feat: restricted plugin format
- 1813185: feat: sequence node

## 1.4.2

### Patch Changes

- fix byte lengths

## 1.4.1

### Patch Changes

- 3995cc1: security enhancements

## 1.4.0

### Minor Changes

- aae0bc1: Project restructure
