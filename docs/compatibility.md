# Compatibility

All serialization methods can accept a `{ disabledFeatures: number }` option. This option influences how the serialization will process and emit a value.

```js
import { serialize, Feature } from 'seroval';

const y = Object.create(null);
y.self = y;
y.example = 'Hello World';

function serializeWithTarget(value, disabledFeatures) {
  const result = serialize(value, {
    disabledFeatures,
  });
  console.log(result);
}

serializeWithTarget(y, Feature.ArrowFunction | Feature.ObjectAssign);
serializeWithTarget(y, 0);
```

```js
(function(h){return (h=(h=Object.create(null),h.example="Hello World",h),h.self=h,h)})()
(h=>(h=Object.assign(Object.create(null),{example:"Hello World"}),h.self=h,h))()
```

`disabledFeatures` uses bit flags for faster checking, so if you need to disable multiple features, you can use the bitwise OR symbol (`|`).

Here's an `ES2017` flag:

```js
import { serialize, Feature } from 'seroval';

const ES2017FLAG = 
  Feature.AggregateError // ES2021
  | Feature.BigIntTypedArray // ES2020;

serialize(myValue, {
  disabledFeatures: ES2017FLAG,
})
```

By default, all feature flags are enabled. The following are the feature flags and their behavior when disabled:

- [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError)
  - Compiles down to `Error` instead.
- [`ArrowFunction`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
  - Uses function expressions for top-level and for deferred `Promise` values
  - Uses function expressions for `Iterable`
  - Uses function expressions for `AsyncIterable`
- [`ErrorPrototypeStack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack)
  - Skipped when detected.
  - Affects both `Error` and `AggregateError`
- [`ObjectAssign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  - Uses manual object assignments instead.
  - Affects `Iterable`, `Error`, `AggregateError` and `Object.create(null)`
- [`BigIntTypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)
  - Disables serialization of `BigInt64Array` and `BigUint64Array`

## Supported Types

- sync = `serialize`, `toJSON`, `crossSerialize`, `toCrossJSON`
- async = `serializeAsync`, `toJSONAsync`, `crossSerializeAsync`, `toCrossJSONAsync`
- streaming = `crossSerializeStream`, `toCrossJSONStream`, `Serializer`

| Type | sync | async | streaming |
| --- | --- | --- | --- |
| `NaN` | ✅ | ✅ | ✅ |
| `Infinity` | ✅ | ✅ | ✅ |
| `-Infinity` | ✅ | ✅ | ✅ |
| `-Infinity` | ✅ | ✅ | ✅ |
| `-0` | ✅ | ✅ | ✅ |
| `number` | ✅ | ✅ | ✅ |
| `string` | ✅ | ✅ | ✅ |
| `boolean` | ✅ | ✅ | ✅ |
| `null` | ✅ | ✅ | ✅ |
| `undefined` | ✅ | ✅ | ✅ |
| `bigint` | ✅ | ✅ | ✅ |
| `Array` | ✅ | ✅ | ✅ |
| sparse (holey) `Arrays` | ✅ | ✅ | ✅ |
| `Object` | ✅ | ✅ | ✅ |
| `RegExp` | ✅ | ✅ | ✅ |
| `Date` | ✅ | ✅ | ✅ |
| `Map` | ✅ | ✅ | ✅ |
| `Set` | ✅ | ✅ | ✅ |
| `Object.create(null)` | ✅ | ✅ | ✅ |
| `ArrayBuffer` | ✅ | ✅ | ✅ |
| `DataView` | ✅ | ✅ | ✅ |
| `Int8Array` | ✅ | ✅ | ✅ |
| `Int16Array` | ✅ | ✅ | ✅ |
| `Int32Array` | ✅ | ✅ | ✅ |
| `Uint8Array` | ✅ | ✅ | ✅ |
| `Uint16Array` | ✅ | ✅ | ✅ |
| `Uint32Array` | ✅ | ✅ | ✅ |
| `Uint8ClampedArray` | ✅ | ✅ | ✅ |
| `Float32Array` | ✅ | ✅ | ✅ |
| `Float64Array` | ✅ | ✅ | ✅ |
| `BigInt64Array` | ❓[^1] | ❓[^1] | ❓[^1] |
| `BigUint64Array` | ❓[^1] | ❓[^1] | ❓[^1] |
| `Error` | ✅[^2] | ✅[^2] | ✅[^2] |
| `AggregateError` | ✅[^2][^3] | ✅[^2][^3] | ✅[^2][^3] |
| `EvalError` | ✅[^2] | ✅[^2] | ✅[^2] |
| `RangeError` | ✅[^2] | ✅[^2] | ✅[^2] |
| `ReferenceError` | ✅[^2] | ✅[^2] | ✅[^2] |
| `SyntaxError` | ✅[^2] | ✅[^2] | ✅[^2] |
| `TypeError` | ✅[^2] | ✅[^2] | ✅[^2] |
| `URIError` | ✅[^2] | ✅[^2] | ✅[^2] |
| `Promise` | ❌ | ✅ | ✅ |
| [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol) | ✅ | ✅ | ✅ |
| [Well-known symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#static_properties) | ✅ | ✅ | ✅ |
| [`AsyncIterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols) | ❌ | ✅ | ✅ |
| Built-in streaming primitive | ✅ | ✅ | ✅ |
| Cyclic references | ✅ | ✅ | ✅ |
| Isomorphic references | ✅ | ✅ | ✅ |

### `seroval-plugins/web`

| Type | sync | async | streaming |
| [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) | ✅ | ✅ | ✅ |
| [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | ✅ | ✅ | ✅ |
| [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | ❌ | ✅ | ❌[^5] |
| [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) | ❌ | ✅ | ❌[^5] |
| [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) | ✅ | ✅ | ✅ |
| [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) | ✅[^4] | ✅ | ✅[^4] |
| [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) | ❌ | ✅ | ✅ |
| [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) | ❌ | ✅ | ✅ |
| [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) | ❌ | ✅ | ✅ |
| [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event) | ✅ | ✅ | ✅ |
| [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) | ✅ | ✅ | ✅ |
| [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException) | ✅ | ✅ |  ✅ |
| [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData) | ✅ | ✅ |  ✅ |

[^1]: `Feature.BigIntTypedArray` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^2]: `Feature.ErrorPrototypeStack` must be enabled if serializing `Error.prototype.stack` is desired.
[^3]: `Feature.AggregateError` must be enabled, otherwise `AggregateError` is serialized into an `Error` instance.
[^4]: `FormData` is partially supported if it doesn't contain any `Blob` or `File` instances.
[^5]: Due to the nature of `Blob` and `File` being an async type (in that it returns a `Promise`-based serializable data) while having a sync constructor, it cannot be represented in a way that the type is consistent to its original declaration.
