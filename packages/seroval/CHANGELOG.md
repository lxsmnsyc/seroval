# seroval

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
