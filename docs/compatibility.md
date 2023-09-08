# Compatibility

## Supported Types

| Type | `serialize` | `serializeAsync` | `crossSerialize` | `crossSerializeAsync` | `crossSerializeStream` | `Serializer` |
| --- | --- | --- | --- | --- | --- | --- |
| `NaN` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Infinity` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `-Infinity` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `-Infinity` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `-0` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `number` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `string` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `boolean` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `null` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `undefined` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bigint` | ❓[^1] | ❓[^1] | ❓[^1] | ❓[^1] | ❓[^1] | ❓[^1] |
| `Array` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| sparse (holey) `Arrays` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Object` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `RegExp` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Date` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Map` | ❓[^2] | ❓[^2] | ❓[^2] | ❓[^2] | ❓[^2] | ❓[^2] |
| `Set` | ❓[^3] | ❓[^3] | ❓[^3] | ❓[^3] | ❓[^3] | ❓[^3] |
| `Object.create(null)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ArrayBuffer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DataView` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Int8Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Int16Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Int32Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint8Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint16Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint32Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Uint8ClampedArray` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Float32Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `Float64Array` | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] | ❓[^4] |
| `BigInt64Array` | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] |
| `BigUint64Array` | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] | ❓[^1][^5] |
| `Error` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `AggregateError` | ✅[^6][^7] | ✅[^6][^7] | ✅[^6][^7] | ✅[^6][^7] | ✅[^6][^7] | ✅[^6][^7] |
| `EvalError` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `RangeError` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `ReferenceError` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `SyntaxError` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `TypeError` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `URIError` | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] | ✅[^6] |
| `Promise` | ❌ | ❓[^11] | ❌ | ❓[^11] | ❓[^11] | ❓[^11] |
| [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol) | ❓[^8] | ❓[^8] | ❓[^8] | ❓[^8] | ❓[^8] | ❓[^8] |
| [Well-known symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#static_properties) | ❓[^8] | ❓[^8] | ❓[^8] | ❓[^8] | ❓[^8] | ❓[^8] |
| [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] |
| [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] |
| [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | ❌ | ❓[^9] | ❌ | ❓[^9] | ❌[^12] | ❌[^12] 
| [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) | ❌ | ❓[^9] | ❌ | ❓[^9] | ❌[^12] | ❌[^12]
| [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] | ❓[^9] |
| [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) | ❓[^9][^10] | ❓[^9] | ❓[^9][^10] | ❓[^9] | ❓[^9][^10] | ❓[^9][^10] |
| Cyclic references | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Isomorphic references | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

[^1]: `Feature.BigInt` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^2]: `Feature.Map` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^3]: `Feature.Set` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^4]: `Feature.TypedArray` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^5]: `Feature.BigIntTypedArray` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^6]: `Feature.ErrorPrototypeStack` must be enabled if serializing `Error.prototype.stack` is desired.
[^7]: `Feature.AggregateError` must be enabled, otherwise `AggregateError` is serialized into an `Error` instance.
[^8]: `Feature.Symbol` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^9]: `Feature.WebAPI` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^10]: `FormData` is partially supported if it doesn't contain any `Blob` or `File` instances.
[^11]: `Feature.Promise` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^12]: Due to the nature of `Blob` and `File` being an async type (in that it returns a `Promise`-based serializable data), it cannot be represented in a way that the type is consistent to its original declaration.
