# Serialization

`seroval` offers different modes of serialization

- `serialize`
- `serializeAsync`
- `toJSON`
- `toJSONAsync`
- `crossSerialize`
- `crossSerializeAsync`
- `crossSerializeStream`
- `toCrossJSON`
- `toCrossJSONAsync`
- `toCrossJSONStream`

## Basic serialization

`serialize` and `serializeAsync` offers the basic serialization, with the latter having support for serializing `Promise`, `Blob` and `File`.

```js
import { serialize, serializeAsync } from 'seroval';
```

Both of these functions return a JS string that one can either run in `eval`, wrap in a `<script>` tag and insert in the HTML output, or use `deserialize`

```js
import { deserialize } from 'seroval';
```

## JSON serialization

`serialize` and `serializeAsync` is ideal for server-to-client communication, however, client-to-server communication requires a sanitized data, because the medium is prone to [RCE](https://huntr.dev/bounties/63f1ff91-48f3-4886-a179-103f1ddd8ff8).

`toJSON` and `toJSONAsync` offers an alternative format: instead of returning a JS string, it returns a JSON object that represents the data to be deserialized. This same object is used internally for other serialization methods.

```js
import { toJSON, toJSONAsync } from 'seroval';
```

To reconstruct the data from the JSON output, `fromJSON` can be used.

```js
import { fromJSON } from 'seroval';
```

To produce the JS string from the JSON output, `compileJSON` can be used.

```js
import { compileJSON } from 'seroval';
```

## Cross-reference serialization

`crossSerialize` and `crossSerializeAsync` allows sharing mapped references between multiple calls. This is useful for inserting multiple JS string in HTML output where objects can re-occur at different times.

```js
import { crossSerialize, crossSerializeAsync } from 'seroval';
```

Cross-reference serialization provides a different JS output, and so requires prepending a header script provided by `GLOBAL_CONTEXT_API_SCRIPT` and `getCrossReferenceHeader`.

## Streaming serialization

Async serialization allows `Promise` instances to be serialized by `await`-ing it, however, this results in a blocking process. With streaming serialization, `Promise` instances can be streamed later on, while the synchronous values can be emitted immediately.

```js
import { crossSerializeStream, Serializer } from 'seroval';
```

### `crossSerializeStream`

`crossSerializeStream` is a push-once streaming, cross-reference serialization method. `crossSerializeStream` receives a value, and streams the rest of the deferred values over time. Deferred values may come from various sources, which includes `Promise` values and `ReadableStream`.

```js
import { crossSerializeStream } from 'seroval';

const stop = crossSerializeStream(data, {
  onSerialize(data, isInitial) {
    // data - the serialized data
    // isInitial - if data is the first data sent.
  },
  onDone() {
    // Called when there's no more data to send
    // or when the stream is stopped.
  },
});
```

Like other cross-reference serialization:

- you can define `refs` for mapping cross-referenced values.
- `crossSerializeStream` would require both `GLOBAL_CONTEXT_API_SCRIPT` and `getCrossReferenceHeader`.

### `Serializer`

## Plugins

```ts
import { createPlugin, type SerovalNode } from 'seroval';

const BufferPlugin = createPlugin<Buffer, SerovalNode>({
  tag: 'Buffer',
  test(value) {
    return value instanceof Buffer;
  },
  parse: {
    sync(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
    async async(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
    stream(value, ctx) {
      return ctx.parse(value.toString('base64'));
    },
  },
  serialize(node, ctx) {
    return `Buffer.from(${ctx.serialize(node)}, "base64")`;
  },
  deserialize(node, ctx) {
    return Buffer.from(ctx.deserialize(node) as string, 'base64');
  },
});
```
