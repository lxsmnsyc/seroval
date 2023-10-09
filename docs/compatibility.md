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
(function(h){return (h=Object.create(null),h.self=h,h.example="Hello World",h)})()
(h=>(h=Object.assign(Object.create(null),{example:"Hello World"}),h.self=h,h))()
```

`disabledFeatures` uses bit flags for faster checking, so if you need to disable multiple features, you can use the bitwise OR symbol (`|`).

Here's an `ES2017` flag:

```js
import { serialize, Feature } from 'seroval';

const ES2017FLAG = 
  Feature.AggregateError // ES2021
  | Feature.BigInt // ES2020
  | Feature.BigIntTypedArray // ES2020;

serialize(myValue, {
  disabledFeatures: ES2017FLAG,
})
```

By default, all feature flags are enabled. The following are the feature flags and their behavior when disabled:

- [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError)
  - Compiles down to `Error` instead.
- [`ArrayPrototypeValues`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/values)
  - Used for `Iterable`, uses `Symbol.iterator` instead.
- [`ArrowFunction`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
  - Uses function expressions for top-level and for deferred `Promise` values
  - method shorthands (if `MethodShortand` is not set) or function expressions for `Iterable`.
- [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
  - Throws when attempted to use, includes `BigIntTypedArray`
  - Disables use of `BigInt`, `BigInt64Array` and `BigUint64Array`
- [`ErrorPrototypeStack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack)
  - Skipped when detected.
  - Affects both `Error` and `AggregateError`
- [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
  - Throws when attempted to use.
  - Disables serialization of `Map`
- [`MethodShorthand`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions)
  - Uses function expressions instead.
  - Only affects `Iterable`
- [`ObjectAssign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  - Uses manual object assignments instead.
  - Affects `Iterable`, `Error`, `AggregateError` and `Object.create(null)`
- [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
  - Throws when attempted to use in `serializeAsync` and `toJSONAsync`.
  - Disables serialization of `Promise`
- [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
  - Throws when attempted to use.
  - Disables serialization of `Set`
- [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
  - Throws when attempted to use.
  - This disables serialization of well-known symbols and `Iterable`.
- [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)
  - Throws when attempted to use.
  - Disables serialization of `TypedArray`
- [`BigIntTypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)
  - Throws when attempted to use
  - Also throws if `BigInt` is disabled.
  - Disables serialization of `BigInt64Array` and `BigUint64Array`
- `WebAPI`
  - Throws and disables the following usage:
    - [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL)
    - [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
    - [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
    - [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File)
    - [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
    - [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
    - [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)

## Supported Types

- sync = `serialize`, `toJSON`, `crossSerialize`
- async = `serializeAsync`, `toJSONAsync`, `crossSerializeAsync`
- streaming = `crossSerializeStream`, `Serializer`

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
| `bigint` | ❓[^1] | ❓[^1] | ❓[^1] |
| `Array` | ✅ | ✅ | ✅ |
| sparse (holey) `Arrays` | ✅ | ✅ | ✅ |
| `Object` | ✅ | ✅ | ✅ |
| `RegExp` | ✅ | ✅ | ✅ |
| `Date` | ✅ | ✅ | ✅ |
| `Map` | ❓[^2] | ❓[^2] | ❓[^2] |
| `Set` | ❓[^3] | ❓[^3] | ❓[^3] |
| `Object.create(null)` | ✅ | ✅ | ✅ |
| `ArrayBuffer` | ❓[^4] | ❓[^4] | ❓[^4] |
| `DataView` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Int8Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Int16Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Int32Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint8Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint16Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint32Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint8ClampedArray` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Float32Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `Float64Array` | ❓[^4] | ❓[^4] | ❓[^4] |
| `BigInt64Array` | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] |
| `BigUint64Array` | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] |
| `Error` | ✅[^6] | ✅[^6] | ✅[^6] |
| `AggregateError` | ✅[^6][^7] | ✅[^6][^7] | ✅[^6][^7] |
| `EvalError` | ✅[^6] | ✅[^6] | ✅[^6] |
| `RangeError` | ✅[^6] | ✅[^6] | ✅[^6] |
| `ReferenceError` | ✅[^6] | ✅[^6] | ✅[^6] |
| `SyntaxError` | ✅[^6] | ✅[^6] | ✅[^6] |
| `TypeError` | ✅[^6] | ✅[^6] | ✅[^6] |
| `URIError` | ✅[^6] | ✅[^6] | ✅[^6] |
| `Promise` | ❌ | ❓[^11] | ❓[^11] |
| [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol) | ❓[^8] | ❓[^8] | ❓[^8] |
| [Well-known symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#static_properties) | ❓[^8] | ❓[^8] | ❓[^8] |
| [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) | ❓[^9] | ❓[^9] | ❓[^9] |
| [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | ❓[^9] | ❓[^9] | ❓[^9] |
| [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | ❌ | ❓[^9][^13] | ❌[^12] |
| [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) | ❌ | ❓[^9][^13] | ❌[^12] |
| [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) | ❓[^9] | ❓[^9] | ❓[^9] |
| [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) | ❓[^9][^10] | ❓[^9] | ❓[^9][^10] |
| [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) | ❌ | ❌ | ❓[^9] |
| [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) | ❌ | ❓[^9][^13] | ❓[^9][^13] |
| [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) | ❌ | ❓[^9][^13] | ❓[^9][^13] |
| [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event) | ❓[^9] | ❓[^9] | ❓[^9] |
| Cyclic references | ✅ | ✅ | ✅ |
| Isomorphic references | ✅ | ✅ | ✅ |

[^1]: `Feature.BigInt` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^2]: `Feature.Map` must be enabled, otherwise falls back to `Symbol.iterator` (if `Feature.Symbol` is enabled).
[^3]: `Feature.Set` must be enabled, otherwise falls back to `Symbol.iterator` (if `Feature.Symbol` is enabled).
[^4]: `Feature.TypedArray` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^5]: `Feature.BigIntTypedArray` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^6]: `Feature.ErrorPrototypeStack` must be enabled if serializing `Error.prototype.stack` is desired.
[^7]: `Feature.AggregateError` must be enabled, otherwise `AggregateError` is serialized into an `Error` instance.
[^8]: `Feature.Symbol` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^9]: `Feature.WebAPI` must be enabled, otherwise throws an `UnsupportedTypeError` (except for `Iterable ` instances, whereas `Feature.Symbol` must be enabled).
[^10]: `FormData` is partially supported if it doesn't contain any `Blob` or `File` instances.
[^11]: `Feature.Promise` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^12]: Due to the nature of `Blob` and `File` being an async type (in that it returns a `Promise`-based serializable data), it cannot be represented in a way that the type is consistent to its original declaration.
[^13]: Indirectly affected by the `Feature.TypedArray` flag.
