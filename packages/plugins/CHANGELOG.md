# seroval-plugins

## 1.7.5

### Patch Changes

- Check the FormData, Headers, Response and Request fields during deserialization.

## 1.7.4

### Patch Changes

- Check that a ReadableStream's stream source is a seroval Stream before deserializing it.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- 2d03651: `serialize`, `toJSON`, `crossSerialize` and `toCrossJSON` now throw when the value contains an async iterable or a `ReadableStream`, as they do for a promise. Before, they sent a stream that never got its values. Use an async or streaming function to send them.

## 1.7.0

### Minor Changes

- 4c0008f: Add `createLiveStream()`, a single-consumer stream that holds one event at a time and resolves each producer write only after the serialized record is accepted. `crossSerializeStream` and `toCrossJSONStream` callbacks may now return a promise; the next record, and the acceptance of the source event behind it, wait for it to settle. Records discovered while parsing an event are emitted after the record that introduces them, one callback runs at a time, `onDone` waits for the last callback and is not called after an output failure, and cleanup runs every callback once. Async iterables and `ReadableStream` values read their next chunk only after the previous record is accepted. Existing streaming plugin lifecycle hooks remain available; parsing a live stream is the preferred way to connect an incremental source.
- f2b7d0c: Raise the supported Node.js floor from `>=10` to `>=20` in `engines`, remove the no-op `typesVersions` from seroval, give seroval-plugins `main`, `module` and `types` fields plus a `typesVersions` entry that points at the emitted `web` declarations, and link the plugins package to the workspace copy of seroval.
- 5ab601f: Add plugin context hooks for parsing an async iterable as a stream source. Use them in the ReadableStream plugin to avoid a separate live-stream producer while keeping backpressure, cancellation, and wire format intact. Upgrade both packages together because the plugin requires the new core hooks.

### Patch Changes

- c643404: The documentation moved to https://seroval.vercel.app. The READMEs and the package homepages now link to it.
- a1e185a: Build with an explicit ES2020 syntax target so the emitted syntax floor no longer follows `engines.node`, keeping nullish coalescing and optional chaining as written.
- be1f32b: Improve tree shaking of web namespace imports in ESM builds while preserving the CommonJS export shape.
- 90e8f73: The web plugins that match instances of a built-in class, such as `URL`, `Blob` and `Headers`, now set `skipPlainObjects`. With a seroval version that supports it, serializing plain objects with these plugins is faster.

## 1.6.12

## 1.6.11

## 1.6.10

## 1.6.9

## 1.6.8

### Patch Changes

- 40d7fd4: Check string, number and `ArrayBuffer` fields at runtime when deserializing the URL, URLSearchParams, Request, DOMException, Event, CustomEvent, Blob, File and ImageData plugins. A field of the wrong type now throws instead of being coerced by the Web constructor.

## 1.6.7

## 1.6.6

### Patch Changes

- 7770e48: Drain async iterables and ReadableStreams iteratively to avoid retaining an async call chain for every streamed value.
- f97aea7: Release ReadableStream reader locks when reading fails during async serialization.

## 1.6.5

### Patch Changes

- Throw when the `AbortController` factory helper is deserialized directly instead of returning its internal function.
- Validate the backing source of an iterator, async iterator, readable stream, and abort signal during deserialization, and export `isStream`.

## 1.6.4

### Patch Changes

- Validate the buffer source of a typed array or `DataView` during deserialization.

## 1.6.3

## 1.6.2

## 1.6.1

### Patch Changes

- f84d457: fix CJS/ESM builds

## 1.6.0

### Minor Changes

- add Temporal support

### Patch Changes

- c9dbda4: Serialized constructors now survive name-preserving bundler transforms (e.g. esbuild `keepNames`, which some platforms apply to hosted code downstream of the app's own build): every nested function in a `toString()`-serialized constructor uses method shorthand, so no bundle-scoped name helper leaks into payloads evaluated in realms that never loaded the bundle.

## 1.5.6

## 1.5.5

### Patch Changes

- serialization fixes

## 1.5.4

## 1.5.3

## 1.5.2

## 1.5.1

## 1.5.0

### Minor Changes

- ac27f21: feat: restricted plugin format

## 1.4.2

## 1.4.1

### Patch Changes

- 3995cc1: security enhancements

## 1.4.0

### Minor Changes

- aae0bc1: Project restructure
