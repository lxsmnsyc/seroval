# Binary Mode Specification

## Data Types

Use this as a guide for the terms used in the document.

- `byte`: 8-bit value, the smallest value possible in binary mode.
- `int`: 32-bit (4 bytes) signed integer, between -2,147,483,648 and 2,147,483,647.
- `uint`: 32-bit (4 bytes) unsigned integer, between 0 and 4,294,967,295.
- `number`: a JS number serialized as 64-bit (8 bytes) floating point.
- `id`: a `uint` that is used to identify a value.
- `ref`: a `uint` that holds a known `id` value, used to access the value being represented by `id`.
- `node`: a `node` is a series of `byte`s that is used to represent the data type or the action that is serialized.
- `buffer`: a series of `byte` of arbitrary length

## Structure

A serialized payload is a stream of `node`s, not a single tree:

- The `Preamble` is always the first node.
- Every value is assigned an `id` when its node is emitted, and a value's node
  is always emitted before any node that references it — so a `ref` never points
  forward. Cyclic references work because a container's `id` exists before its
  child assignments are emitted.
- Container values are emitted as a declaration node (e.g. `Object`, `Array`,
  `Map`) followed by their action nodes (`ObjectAssign`, `ArrayAssign`,
  `MapSet`, ...) and a closing `Pending` node.
- The `Root` node marks the top-level value. It is emitted once the synchronous
  part of the value has been written; nodes for asynchronous values
  (`PromiseSuccess` / `PromiseFailure`, `StreamNext` / `StreamThrow` /
  `StreamReturn`, and their `Pending`) may follow the `Root` as those values
  settle.

Numeric fields (`int`, `uint`, `number`) are encoded using the endianness
declared in the `Preamble`.

## Node Types

### `Preamble`

```
<byte:preamble=0> <byte:endianness>
```

The `Preamble` node type is the first node being sent during serialization. It's meant to provide information
as to how the rest of the data being sent is going to be interpreted (think of it as a header).

Currently, the `Preamble` node type only encodes one value which is the endianness used by the serializer:

- `1` for little endian
- `2` for big endian.

Endianness allows the deserializer to know how the data types like `int` are encoded.

### `Root`

```
<byte:root=1> <ref>
```

The `Root` node identifies the target of the serialization.

### `Constant`

```
<byte:constant=2> <id> <byte:constant>
```

A `Constant` is a set of known values in a JS runtime, which is one of the following:

- `0`: `null`
- `1`: `undefined`
- `2`: `true`
- `3`: `false`
- `4`: `-0` (this is different from `0` in JS)
- `5`: `Infinity`
- `6`: `-Infinity`
- `7`: `NaN`

### `Number`

```
<byte:number=3> <id> <number>
```

A finite, ordinary JS `number`. The special values `-0`, `NaN`, `Infinity` and
`-Infinity` are not serialized here — they are emitted as `Constant` nodes.

### `String`

```
<byte:string=4> <id> <uint:length> <buffer>
```

`length` is used to identify the number of bytes of the `buffer`

### `BigInt`

```
<byte:bigint=5> <id> <byte:is-negative> <ref:value=string>
```

`bigint` is encoded as a pair of hex values converted into a `byte`. The resulting sequence is serialized as a string,
which is what we use to reference here. `byte:is-negative` is a boolean `byte` that tells if the `bigint` is negative
or not.

### `WKSymbol`

```
<byte:wksymbol=6> <id> <byte:symbol>
```

`wksymbol` stands for "well-known symbol", a set of symbols that are already declared by the JS runtime, which is one of the following:

- `0`: `Symbol.asyncIterator`
- `1`: `Symbol.hasInstance`
- `2`: `Symbol.isConcatSpreadable`
- `3`: `Symbol.iterator`
- `4`: `Symbol.match`
- `5`: `Symbol.matchAll`
- `6`: `Symbol.replace`
- `7`: `Symbol.search`
- `8`: `Symbol.species`
- `9`: `Symbol.split`
- `10`: `Symbol.toPrimitive`
- `11`: `Symbol.toStringTag`
- `12`: `Symbol.unscopables`

### `ObjectAssign`

```
<byte:object-assign=7> <ref:target=object|null-constructor|error|aggregate-error> <ref:property=string|wksymbol> <ref:value>
```

`ObjectAssign` is an action node type for assigning a `ref:value` to a `ref:target`'s `ref:property`.

As for the `wksymbol`, it can only serialize `Symbol.iterator`, `Symbol.asyncIterator`, `Symbol.isConcatSpreadable` and `Symbol.toStringTag`

This node is serialized immediately after an `Object`, `NullConstructor`, `Error` or `AggregateError` node has been serialized.

### `ArrayAssign`

```
<byte:array-assign=8> <ref:target=array> <uint32:index> <ref:value>
```

`ArrayAssign` is an action node type for assigning a `ref:value` to a `ref:target` at the given `index`.

This node is serialized immediately after an `Array` node has been serialized.

### `ObjectFlag`

```
<byte:object-flag=9> <ref:target=object|null-constructor|array> <byte:flag>
```

An `ObjectFlag` is an action node type for changing the state of the `ref:target`, which could be one of the following values:

- `0`: the target will not be modified
- `1`: `Object.preventExtensions`
- `2`: `Object.seal`
- `3`: `Object.freeze`

### `Array`

```
<byte:array=10> <id> <uint:length>
```

Declares an array of the given `length`. Its elements are assigned afterwards
through `ArrayAssign` nodes; a hole (an unassigned index in a sparse array) is
simply never assigned, so `length` may exceed the number of `ArrayAssign` nodes.

### `Stream`

```
<byte:stream=11> <id>
```

A `Stream` represents an observable data that sends and receives value over time.

### `StreamNext`

```
<byte:stream-next=12> <ref:stream> <ref:value>
```

Pushes `ref:value` onto `ref:stream` as its next value. A stream may receive any
number of these over time.

### `StreamThrow`

```
<byte:stream-throw=13> <ref:stream> <ref:value>
```

Ends `ref:stream` with an error, `ref:value`. No further stream nodes for that
stream follow.

### `StreamReturn`

```
<byte:stream-return=14> <ref:stream> <ref:value>
```

Ends `ref:stream` normally with a final value, `ref:value`. No further stream
nodes for that stream follow.

### `Sequence`

```
<byte:sequence=15> <id> <int:throws-at> <int:done-at>
```

Since `throws-at` will have the value of `-1` if `done-at` has a value greater than or equal to `0`.
The same also applies to `done-at`.

### `SequencePush`

```
<byte:sequence-push=16> <ref:sequence> <ref:value>
```

`SequencePush` is an action node type that inserts a `ref:value` to a `ref:sequence`.
This node type is serialized immediately after a `Sequence` node has been serialized.

### `Plugin`

```
<byte:plugin=17> <id> <ref:tag=string> <ref:config>
```

`ref:config` is whatever the plugin's `binary.serialize` returns, serialized as a
value; it is not required to be an object.

### `Object`

```
<byte:object=18> <id>
```

Declares a plain object (`{}`). Its properties are assigned afterwards through
`ObjectAssign` nodes, and its final extensibility state through an `ObjectFlag`
node.

### `NullConstructor`

```
<byte:null-constructor=19> <id>
```

This node type is for `Object.create(null)`

### `Date`

```
<byte:date=20> <id> <number:timestamp>
```

A `Date` reconstructed from `timestamp`, the number of milliseconds since the
Unix epoch (`Date.prototype.getTime`). An invalid date is encoded as a `NaN`
timestamp.

### `Error`

```
<byte:error=21> <id> <byte:constructor> <ref:message=string>
```

`byte:constructor` is one of the following:

- `0`: `Error`
- `1`: `EvalError`
- `2`: `RangeError`
- `3`: `ReferenceError`
- `4`: `SyntaxError`
- `5`: `TypeError`
- `6`: `URIError`

### `Boxed`

```
<byte:boxed=22> <id> <ref:value>
```

`Boxed` represents a value constructed through `Object(value)`

### `ArrayBuffer`

```
<byte:array-buffer=23> <id> <uint:length> <buffer>
```

An `ArrayBuffer` whose `length` bytes follow inline as `buffer`. `TypedArray`,
`BigIntTypedArray` and `DataView` nodes reference an `ArrayBuffer` by id rather
than repeating its bytes, so views over the same buffer stay shared.

### `TypedArray`

```
<byte:typed-array=24> <id> <byte:constructor> <ref:array-buffer> <uint:offset> <uint:length>
```

A typed-array view of `byte:constructor`'s kind over the referenced
`ArrayBuffer`, starting at `offset` bytes and spanning `length` elements.

`byte:constructor` is one of the following:

- `1`: `Int8Array`
- `2`: `Int16Array`
- `3`: `Int32Array`
- `4`: `Uint8Array`
- `5`: `Uint16Array`
- `6`: `Uint32Array`
- `7`: `Uint8ClampedArray`
- `8`: `Float32Array`
- `9`: `Float64Array`

### `BigIntTypedArray`

```
<byte:bigint-typed-array=25> <id> <byte:constructor> <ref:array-buffer> <uint:offset> <uint:length>
```

The bigint-valued counterpart of `TypedArray`, viewing the referenced
`ArrayBuffer` from `offset` bytes across `length` elements.

`byte:constructor` is one of the following:

- `1`: `BigInt64Array`
- `2`: `BigUint64Array`

### `DataView`

```
<byte:data-view=26> <id> <ref:array-buffer> <uint:offset> <uint:length>
```

A `DataView` over the referenced `ArrayBuffer`, starting at `offset` bytes and
spanning `length` bytes.

### `Map`

```
<byte:map=27> <id>
```

Declares an empty `Map`. Its entries are added afterwards through `MapSet` nodes,
preserving insertion order.

### `MapSet`

```
<byte:map-set=28> <ref:map> <ref:key> <ref:value>
```

`MapSet` is an action node type that assigns a `ref:value` to a `ref:key` of a `ref:map`
This node type is serialized immediately after a `Map` node has been serialized.

### `Set`

```
<byte:set=29> <id>
```

Declares an empty `Set`. Its members are added afterwards through `SetAdd` nodes,
preserving insertion order.

### `SetAdd`

```
<byte:set-add=30> <ref:set> <ref:value>
```

`SetAdd` is an action node type that adds a `ref:value` to a `ref:set`
This node type is serialized immediately after a `Set` node has been serialized.

### `Promise`

```
<byte:promise=31> <id>
```

Declares a pending `Promise`. It is settled later — possibly after the `Root`
node — by exactly one `PromiseSuccess` or `PromiseFailure` node referencing this
`id`.

### `PromiseSuccess`

```
<byte:promise-success=32> <ref:promise> <ref:value>
```

Resolves `ref:promise` with `ref:value`.

### `PromiseFailure`

```
<byte:promise-failure=33> <ref:promise> <ref:value>
```

Rejects `ref:promise` with `ref:value`.

### `RegExp`

```
<byte:regexp=34> <id> <ref:pattern=string> <ref:flags=string>
```

A `RegExp` built from its `source` (`pattern`) and `flags`, both referenced as
strings. Requires the `RegExp` feature; see the compatibility docs.

### `AggregateError`

```
<byte:aggregate-error=35> <id> <ref:message=string>
```

An `AggregateError` carrying `ref:message`. Its aggregated `errors` and any other
own properties follow as `ObjectAssign` nodes targeting this `id`.

### `Iterator`

```
<byte:iterator=36> <id> <ref:sequence>
```

`Iterator` is for generating the callbacks for `Symbol.iterator` derived from a `Sequence`

### `AsyncIterator`

```
<byte:async-iterator=37> <id> <ref:stream>
```

`AsyncIterator` is for generating the callbacks for `Symbol.asyncIterator` derived from a `Stream`

### `Pending`

```
<byte:pending=38> <ref:target> <uint:amount>
```

A `Pending` node tells the deserializer how many child assignments a container
(`Object`, `NullConstructor`, `Array`, `Map`, `Set`, `Sequence`, `Error` or
`AggregateError`) still expects before it is considered complete. It is emitted
after the container's assignment nodes, and its `amount` is the number of those
assignments. The deserializer counts assignments down against it so a consumer
can wait for the container to be fully populated.

### `Temporal`

```
<byte:temporal=39> <id> <byte:temporal-type> <ref:iso=string>
```

`byte:temporal-type` is one of the following:

- `0`: `Temporal.Instant`
- `1`: `Temporal.Duration`
- `2`: `Temporal.PlainDate`
- `3`: `Temporal.PlainDateTime`
- `4`: `Temporal.PlainMonthDay`
- `5`: `Temporal.PlainTime`
- `6`: `Temporal.PlainYearMonth`
- `7`: `Temporal.ZonedDateTime`

## Examples

Each example lists the emitted bytes as hexadecimal pairs, using little-endian
encoding (`endianness = 01`), then walks through how they are interpreted. Recall
that a `uint` is 4 bytes and a `number` is 8 bytes.

### `null`

```
00 01   02 01 00 00 00 00   01 01 00 00 00
```

| bytes | node | meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | `00` = preamble, `01` = little-endian |
| `02  01 00 00 00  00` | `Constant` | `02` = constant, id `1`, value `00` = `null` |
| `01  01 00 00 00` | `Root` | `01` = root, references id `1` |

Result: `null`.

### `42`

```
00 01   03 01 00 00 00  00 00 00 00 00 00 45 40   01 01 00 00 00
```

| bytes | node | meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | little-endian |
| `03  01 00 00 00  00 00 00 00 00 00 45 40` | `Number` | `03` = number, id `1`, the 8 bytes are `42.0` as a little-endian float64 |
| `01  01 00 00 00` | `Root` | references id `1` |

Result: `42`.

### `"hi"`

```
00 01   04 01 00 00 00  02 00 00 00  68 69   01 01 00 00 00
```

| bytes | node | meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | little-endian |
| `04  01 00 00 00  02 00 00 00  68 69` | `String` | `04` = string, id `1`, length `2`, UTF-8 bytes `68 69` (`"hi"`) |
| `01  01 00 00 00` | `Root` | references id `1` |

Result: `"hi"`.

### `{ a: 1 }`

This shows the full lifecycle of a container: declare, fill by reference,
announce how many assignments to expect, set the object flag, then point the
root at it.

```
00 01
12 01 00 00 00
04 02 00 00 00  01 00 00 00  61
03 03 00 00 00  00 00 00 00 00 00 F0 3F
07 01 00 00 00  02 00 00 00  03 00 00 00
26 01 00 00 00  01 00 00 00
09 01 00 00 00  00
01 01 00 00 00
```

| bytes | node | meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | little-endian |
| `12  01 00 00 00` | `Object` | `12` = object (`18`), declares `{}` as id `1` |
| `04  02 00 00 00  01 00 00 00  61` | `String` | id `2`, length `1`, byte `61` (`"a"`) — the key |
| `03  03 00 00 00  … F0 3F` | `Number` | id `3`, value `1.0` — the value |
| `07  01 00 00 00  02 00 00 00  03 00 00 00` | `ObjectAssign` | on id `1`, assign key id `2` (`"a"`) the value id `3` (`1`) |
| `26  01 00 00 00  01 00 00 00` | `Pending` | `26` = pending (`38`), id `1` expects `1` assignment |
| `09  01 00 00 00  00` | `ObjectFlag` | id `1`, flag `00` (unmodified / extensible) |
| `01  01 00 00 00` | `Root` | references id `1` |

Result: `{ a: 1 }`.

Note how the key and value are emitted as their own `String` and `Number` nodes
*before* the `ObjectAssign` that references them — a `ref` never points forward.
