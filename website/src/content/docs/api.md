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
| `createPlugin(plugin)` | Defines a plugin, with type inference. | [Writing plugins](./writing-plugins.md) |
| `v` | Validators for a plugin's `validate` field. Also available as `seroval/validator`. | [Plugin security](./plugin-security.md#validate-every-value) |
| `Feature` | Feature flags for `disabledFeatures`. | [Compatibility](./compatibility.md#feature-flags) |

## Options

All options in one place. Each function lists the ones it accepts above.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `plugins` | `Plugin[]` | none | Plugins for extra types. |
| `disabledFeatures` | `number` | `0` | `Feature` flags to turn off, combined with `\|`. |
| `depthLimit` | `number` | `1000` | Maximum nesting depth. |
| `compactArrayBufferViews` | `boolean` | `false` | Send only the bytes each typed array covers. |
| `refs` | `Map` | a new `Map` | Values already sent, shared between cross-reference calls. |
| `scopeId` | `string` | none | Writes to `$R[scopeId]` instead of `$R`. |
| `assignSharedRefsOnly` | `boolean` | `false` | `crossSerialize` and `crossSerializeAsync` only. Stores only the values the output reads more than once in `$R`. |
| `maxBase64Length` | `number` | `1000000` | Largest encoded `ArrayBuffer` that JSON decoding accepts. |
| `onSerialize(chunk, initial)` | function | required | Receives each script chunk of a stream. |
| `onParse(node, initial)` | function | required | Receives each JSON node of a stream. |
| `onDone()` | function | none | Runs when a stream finishes. |
| `onError(error)` | function | none | Runs when a stream fails. |

## Types

seroval also exports TypeScript types for the values above, including `SerovalJSON`, `SerovalNode`, `Plugin`, `SerializeOptions`, `SerializeAsyncOptions`, `ToJSONOptions`, `ToJSONAsyncOptions`, `CrossSerializeOptions`, `Stream`, `StreamListener`, `LiveStream`, `LiveStreamProducer`, `LiveStreamConsumer`, `CrossDeserializer` and the options type of each function.
