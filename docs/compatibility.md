# Compatibility

## Supported Types

| Type | `serialize` |
| --- | --- |
| `NaN` | ✅ |
| `Infinity` | ✅ |
| `-Infinity` | ✅ |
| `-Infinity` | ✅ |
| `-0` | ✅ |
| `number` | ✅ |
| `string` | ✅ |
| `boolean` | ✅ |
| `null` | ✅ |
| `undefined` | ✅ |
| `bigint` | ❓[^1] |
| `Array` | ✅ |
| sparse (holey) `Arrays` | ✅ |
| `Object` | ✅ |
| `RegExp` | ✅ |
| `Date` | ✅ |
| `Map` | ❓[^2] |
| `Set` | ❓[^3] |
| `Object.create(null)` | ✅ |
| `ArrayBuffer` | ✅ |
| `DataView` | ✅ |
| `Int8Array` | ❓[^4] |
| `Int16Array` | ❓[^4] |
| `Int32Array` | ❓[^4] |
| `Uint8Array` | ❓[^4] |
| `Uint16Array` | ❓[^4] |
| `Uint32Array` | ❓[^4] |
| `Uint8ClampedArray` | ❓[^4] |
| `Float32Array` | ❓[^4] |
| `Float64Array` | ❓[^4] |
| `BigInt64Array` | ❓[^1][^5] |
| `BigUint64Array` | ❓[^1][^5] |
| `Error` | ✅ |
| `AggregateError` | ❓[^3] |
| `EvalError` | ✅ |
| `RangeError` | ✅ |
| `ReferenceError` | ✅ |
| `SyntaxError` | ✅ |
| `TypeError` | ✅ |
| `URIError` | ✅ |
| `Promise` | ❌ |
| [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterable_protocol) | ❓[^6] |
| [Well-known symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#static_properties) | ❓[^6] |
| [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) | ❓[^7] |
| [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | ❓[^7] |
| [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | ❌ |
| [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) | ❌ |
| [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) | ❓[^7] |
| [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) | ❓[^7] |
| Cyclic references | ✅ |
| Isomorphic references | ✅ |

[^1]: `Feature.BigInt` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^2]: `Feature.Map` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^3]: `Feature.Set` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^4]: `Feature.TypedArray` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^5]: `Feature.AggregateError` must be enabled, otherwise `AggregateError` is serialized into an `Error` instance.
[^6]: `Feature.Symbol` must be enabled, otherwise throws an `UnsupportedTypeError`.
[^7]: `Feature.WebAPI` must be enabled, otherwise throws an `UnsupportedTypeError`.
