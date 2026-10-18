---
title: API reference
description: Every export of seroval, with its signature and options.
---

## Serialize to JavaScript

| Function | Returns | Guide |
| --- | --- | --- |
| `serialize(value, options?)` | `string` | [Serialize to JavaScript](./javascript-output.md) |
| `serializeAsync(value, options?)` | `Promise<string>` | [Serialize to JavaScript](./javascript-output.md#serializeasync) |
| `deserialize(source)` | the value | [Serialize to JavaScript](./javascript-output.md#deserialize) |

Options: `plugins`, `disabledFeatures`, `depthLimit`, `compactArrayBufferViews`.

## JSON

| Function | Returns | Guide |
| --- | --- | --- |
| `toJSON(value, options?)` | `SerovalJSON` | [JSON](./json.md) |
| `toJSONAsync(value, options?)` | `Promise<SerovalJSON>` | [JSON](./json.md) |
| `fromJSON(tree, options?)` | the value | [JSON](./json.md#fromjson-options) |
| `compileJSON(tree, options?)` | `string` | [JSON](./json.md#compilejson) |

`fromJSON` options: `plugins`, `disabledFeatures`, `depthLimit`, `maxBase64Length`. `compileJSON` options: `plugins`.

## Cross-reference

| Function | Returns | Guide |
| --- | --- | --- |
| `crossSerialize(value, options?)` | `string` | [Cross-reference](./cross-reference.md) |
| `crossSerializeAsync(value, options?)` | `Promise<string>` | [Cross-reference](./cross-reference.md) |
| `crossSerializeStream(value, options)` | stop function | [Streaming](./streaming.md) |
| `toCrossJSON(value, options?)` | `SerovalNode` | [Cross-reference](./cross-reference.md) |
| `toCrossJSONAsync(value, options?)` | `Promise<SerovalNode>` | [Cross-reference](./cross-reference.md) |
| `toCrossJSONStream(value, options)` | stop function | [Streaming](./streaming.md#streaming-json) |
| `fromCrossJSON(node, options)` | the value | [Cross-reference](./cross-reference.md#decoding-cross-reference-json) |
| `createCrossDeserializer(options)` | `CrossDeserializer` | [Streaming](./streaming.md#receiving-a-json-stream) |
| `getCrossReferenceHeader(scopeId?)` | `string` | [Cross-reference](./cross-reference.md#declaring-r) |
| `new Serializer(options)` | `Serializer` | [Streaming](./streaming.md#the-serializer-class) |

## Binary mode

The `binary` namespace. See [Binary mode](./binary-mode.md).

```js
import { binary } from 'seroval';
```

| Function | Returns | Guide |
| --- | --- | --- |
| `binary.serialize(value, options)` | stop function | [Serializing](./binary-mode.md#serializing) |
| `binary.deserialize(options)` | `Promise<{ value }>` | [Deserializing](./binary-mode.md#deserializing) |
| `binary.createReferenceMap()` | `ReferenceMap` | [Sharing references](./binary-mode.md#sharing-references-between-payloads) |

`binary.serialize` options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `refs` | `Map` | required | Values already sent. Share one `Map` between payloads to send references. |
| `onSerialize(bytes)` | function | required | Receives each `Uint8Array` chunk. May return a promise, which holds back the [live stream](./binary-mode.md#live-streams) event behind the chunk. |
| `onDone()` | function | required | Runs once every promise and stream has settled. |
| `onError(error)` | function | required | Runs when a value fails to serialize. |
| `plugins` | `Plugin[]` | none | Plugins with a `binary` section. |
| `disabledFeatures` | `number` | `0` | `Feature` flags to turn off. |
| `features` | `number` | all features | Features to turn on. Overrides `disabledFeatures`. |
| `depthLimit` | `number` | `64` | Maximum nesting depth. |

The stop function cancels every source that is still running and runs plugin cleanups. It does not call `onDone`.

`binary.deserialize` options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `read()` | function | required | Returns a promise for the next `Uint8Array` chunk, or for `undefined` at the end of the input. |
| `onError(error)` | function | required | Runs when the input is invalid or a value cannot be rebuilt. |
| `refs` | `ReferenceMap` | a new map | From `binary.createReferenceMap()`. Share one between payloads to resolve references. |
| `plugins` | `Plugin[]` | none | Plugins with a `binary` section. |
| `disabledFeatures` | `number` | `0` | `Feature` flags to reject. |
| `features` | `number` | all features | Features to accept. Overrides `disabledFeatures`. |

The promise resolves with `{ value }` once the root value is decoded. Promises and streams inside it may still be pending. It rejects if the input is invalid, ends early or `read()` rejects before the root value is ready.

## Streams

| Export | Description | Guide |
| --- | --- | --- |
| `createStream()` | Creates a stream that keeps every value. | [Streams](./streams-and-iterables.md#createstream) |
| `isStream(value)` | Whether a value is a seroval stream. | |
| `createLiveStream(options?)` | Creates a single-reader stream with backpressure. Returns `{ stream, producer }`. | [Live streams](./streams-and-iterables.md#live-streams) |
| `isLiveStream(value)` | Whether a value is a live stream. | |

## References and plugins

| Export | Description | Guide |
| --- | --- | --- |
| `createReference(id, value)` | Sends `value` by its key. | [Isomorphic references](./isomorphic-references.md) |
| `new OpaqueReference(value, replacement?)` | Sends `replacement` instead of `value`. | [OpaqueReference](./isomorphic-references.md#opaquereference) |
| `createPlugin(plugin)` | Defines a plugin, with type inference. Add a `binary` section for binary mode. | [Writing plugins](./writing-plugins.md) |
| `Feature` | Feature flags for `disabledFeatures`. | [Compatibility](./compatibility.md#feature-flags) |

## Options

All options in one place. Each function lists the ones it accepts above. Binary mode has [its own options](#binary-mode).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `plugins` | `Plugin[]` | none | Plugins for extra types. |
| `disabledFeatures` | `number` | `0` | `Feature` flags to turn off, combined with `\|`. |
| `depthLimit` | `number` | `64` | Maximum nesting depth. |
| `compactArrayBufferViews` | `boolean` | `false` | Send only the bytes each typed array covers. |
| `refs` | `Map` | a new `Map` | Values already sent, shared between cross-reference calls. |
| `scopeId` | `string` | none | Writes to `$R[scopeId]` instead of `$R`. |
| `maxBase64Length` | `number` | `1000000` | Largest encoded `ArrayBuffer` that JSON decoding accepts. |
| `onSerialize(chunk, initial)` | function | required | Receives each script chunk of a stream. |
| `onParse(node, initial)` | function | required | Receives each JSON node of a stream. |
| `onDone()` | function | none | Runs when a stream finishes. |
| `onError(error)` | function | none | Runs when a stream fails. |

## Types

seroval also exports TypeScript types for the values above, including `SerovalJSON`, `SerovalNode`, `Plugin`, `SerializeOptions`, `SerializeAsyncOptions`, `ToJSONOptions`, `ToJSONAsyncOptions`, `CrossSerializeOptions`, `Stream`, `StreamListener`, `LiveStream`, `LiveStreamProducer`, `LiveStreamConsumer`, `CrossDeserializer`, `PluginWithBinaryMode`, `BinaryPlugin` and the options type of each function. The `binary` namespace exports `SerializeOptions`, `DeserializeOptions` and `ReferenceMap`.
