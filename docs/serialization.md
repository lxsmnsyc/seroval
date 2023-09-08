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

## Basic serialization

`serialize` and `serializeAsync` offers the basic serialization, with the latter having support for serializing `Promise`, `Blob` and `File`.

Both of these functions return a JS string that one can run in `eval`, or in the usual use-case, wrap in a `<script>` tag and insert in the HTML output.

```js
import { serialize, serializeAsync } from 'seroval';
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

## Streaming serialization

```js
import { crossSerializeStream, Serializer } from 'seroval';
```
