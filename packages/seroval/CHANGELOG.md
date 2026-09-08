# seroval

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
