---
title: Compatibility
description: Supported types in each mode, feature flags for older runtimes, and package resolution.
---

## Supported types

The modes are:

- **Sync**: `serialize`, `toJSON`, `crossSerialize` and `toCrossJSON`.
- **Async**: `serializeAsync`, `toJSONAsync`, `crossSerializeAsync` and `toCrossJSONAsync`.
- **Streaming**: `crossSerializeStream`, `toCrossJSONStream` and `Serializer`.
- **Binary**: `binary.serialize`. See [Binary mode](./binary-mode.md).

| Type | Sync | Async | Streaming | Binary |
| --- | --- | --- | --- | --- |
| `string`, `boolean`, `null`, `undefined` | ✅ | ✅ | ✅ | ✅ |
| `number`, including `NaN`, `Infinity`, `-Infinity` and `-0` | ✅ | ✅ | ✅ | ✅ |
| `bigint` | ✅ | ✅ | ✅ | ✅ |
| `Array`, including sparse arrays | ✅ | ✅ | ✅ | ✅ |
| `Object` and `Object.create(null)` | ✅ | ✅ | ✅ | ✅ |
| Frozen, sealed and non-extensible objects | ✅ | ✅ | ✅ | ✅ |
| `Date` | ✅ | ✅ | ✅ | ✅ |
| Boxed primitives, such as `Object(1)` and `Object('text')` | ✅ | ✅ | ✅ | ✅ |
| `RegExp` | ✅ [^regexp] | ✅ [^regexp] | ✅ [^regexp] | ✅ [^regexp] |
| `Map` and `Set` | ✅ | ✅ | ✅ | ✅ |
| `ArrayBuffer` and `DataView` | ✅ | ✅ | ✅ | ✅ [^limit] |
| `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array` | ✅ | ✅ | ✅ | ✅ [^limit] |
| `BigInt64Array` and `BigUint64Array` | ✅ [^bigint] | ✅ [^bigint] | ✅ [^bigint] | ✅ [^bigint] [^limit] |
| `Error`, `EvalError`, `RangeError`, `ReferenceError`, `SyntaxError`, `TypeError` and `URIError` | ✅ [^stack] | ✅ [^stack] | ✅ [^stack] | ✅ [^stack] |
| `AggregateError` | ✅ [^aggregate] | ✅ [^aggregate] | ✅ [^aggregate] | ✅ [^aggregate] |
| `Temporal` types | ✅ [^temporal] | ✅ [^temporal] | ✅ [^temporal] | ✅ [^temporal] |
| `Promise` | ❌ [^promise] | ✅ | ✅ | ✅ |
| Iterables (`Symbol.iterator`) | ✅ | ✅ | ✅ | ✅ |
| Async iterables (`Symbol.asyncIterator`) | ❌ [^empty] | ✅ | ✅ | ✅ |
| `createStream` and `createLiveStream` | ❌ [^empty] | ✅ | ✅ | ✅ |
| Well-known symbols | ✅ | ✅ | ✅ | ✅ |
| Shared and cyclic references | ✅ | ✅ | ✅ | ✅ |
| [Isomorphic references](./isomorphic-references.md) | ✅ | ✅ | ✅ | ✅ |

[^regexp]: Requires `Feature.RegExp`, which is on by default. When it is off, a `RegExp` throws `SerovalUnsupportedTypeError`.
[^bigint]: Requires `Feature.BigIntTypedArray`, which is on by default. When it is off, these arrays throw `SerovalUnsupportedTypeError`.
[^stack]: The `stack` property is sent only while `Feature.ErrorPrototypeStack` is on.
[^aggregate]: Sent as an `Error` when `Feature.AggregateError` is off.
[^temporal]: Requires `Feature.Temporal`, and a runtime that has the `Temporal` global on both sides.
[^promise]: Sync functions cannot wait for promises, so a promise throws a `SerovalParserError` whose cause is a `SerovalUnsupportedTypeError`.
[^empty]: Sync functions cannot wait for values, so these are sent as an empty stream that never ends. Reading it waits forever.
[^limit]: Binary mode rejects typed arrays longer than 1,000,000 elements and a `DataView` longer than 1,000,000 bytes. An `ArrayBuffer` has no limit.

Web types such as `URL`, `Request` and `FormData` are supported through [plugins](./using-plugins.md#seroval-plugins).

## Feature flags

Every function takes a `disabledFeatures` option. It turns features off, so the output runs in older runtimes, or so a receiver rejects types it does not want.

`disabledFeatures` is a bit mask. Combine flags with `|`:

```js
import { Feature, serialize } from 'seroval';

serialize(value, {
  disabledFeatures: Feature.AggregateError | Feature.BigIntTypedArray,
});
```

| Flag | When disabled |
| --- | --- |
| `Feature.AggregateError` | `AggregateError` is sent as an `Error`. |
| `Feature.ErrorPrototypeStack` | The `stack` property of errors is not sent. |
| `Feature.ObjectAssign` | Output assigns properties one by one instead of calling `Object.assign`. |
| `Feature.BigIntTypedArray` | `BigInt64Array` and `BigUint64Array` throw. |
| `Feature.RegExp` | `RegExp` throws when serialized, and is rejected when decoded. |
| `Feature.Temporal` | `Temporal` values throw when serialized, and are rejected when decoded. |
| `Feature.ArrowFunction` | Deprecated. It has no effect. |

All features are on by default. For example, with `ObjectAssign` disabled:

```js
const value = Object.assign(Object.create(null), { x: 1 });

serialize(value);
// Object.assign(Object.create(null),{x:1})

serialize(value, { disabledFeatures: Feature.ObjectAssign });
// (h=>h=(h=Object.create(null),h.x=1,h))()
```

## Runtimes

seroval runs anywhere modern JavaScript runs: Node.js 20 or later, Deno, Bun, browsers and edge runtimes. It has no dependencies.

## Package resolution

The `seroval` package has ESM and CommonJS builds, and a `development` build with full error messages. Bundlers pick the right one through the package's export conditions:

- The `development` condition selects the build with full error messages.
- The default selects the production build, which reports errors by code. See [Errors](./errors.md).
- The `browser` condition selects the same build as the default, so there is never a second copy of seroval's classes or reference registry.

Resolvers that ignore export conditions, such as older bundlers and some React Native setups, can use the `main` and `module` fields. The base64 encoding of buffers uses `Buffer` when it exists, and portable browser APIs otherwise. Both produce the same output. [Binary mode](./binary-mode.md) does not use base64.
