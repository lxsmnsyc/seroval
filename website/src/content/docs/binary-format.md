---
title: Binary format
description: The wire format of binary mode, with every node type, its byte layout and the rules the decoder checks.
---

This page describes the bytes that [`binary.serialize`](./binary-mode.md) writes and `binary.deserialize` reads. You only need it to write your own encoder or decoder, or to debug a payload.

## Data types

The layouts below use these terms:

| Term | Size | Description |
| --- | --- | --- |
| `byte` | 1 byte | An 8-bit unsigned value. |
| `int` | 4 bytes | A 32-bit signed integer. |
| `uint` | 4 bytes | A 32-bit unsigned integer. |
| `number` | 8 bytes | A JavaScript number, as a 64-bit float. |
| `id` | 4 bytes | A `uint` that declares a new value. |
| `ref` | 4 bytes | A `uint` that holds an `id` declared earlier, and stands for that value. |
| `buffer` | any | A run of bytes whose length is given by an earlier field. |
| `node` | any | A type `byte` followed by the fields of that type. |

`int`, `uint` and `number` use the byte order declared in the [`Preamble`](#preamble). The serializer uses the byte order of its platform.

## Structure

A payload is a stream of nodes, not a single tree:

- The serializer always sends the `Preamble` first.
- Each node declares a value with an `id`, or acts on values declared earlier, such as `ObjectAssign` or `PromiseSuccess`.
- A value's node is always sent before any node that refers to it, so a `ref` never points forward.
- Ids are numbered in the order values are visited, so they do not always grow in the order nodes are sent. For example, an `Error` gets its id before its message, but its node comes after the message's `String` node.
- A value that appears more than once is sent once, and later uses refer to its id. This includes strings and numbers.
- A container is sent as a declaration node, such as `Object`, `Array` or `Map`, then the nodes for its contents, then one `Pending` node. Because a container's id exists before its contents are sent, its contents can refer back to it. This is how cycles work.
- The `Root` node names the top-level value. It is sent once the synchronous part of the value is written.
- Nodes for asynchronous values, such as `PromiseSuccess`, `StreamNext` and the values they carry, can follow the `Root` as those values settle.

The serializer sends the nodes in chunks. The first chunk holds everything up to the `Root`. Each settled promise and each stream event is one more chunk. A decoder must not rely on chunk boundaries: a node can be split across chunks, and a chunk can hold many nodes.

## Validation

The decoder treats its input as untrusted. It rejects a payload that breaks any of these rules:

- The type byte of each node is a known node type.
- An `id` is declared once.
- A `ref` points to an `id` that was already declared, with a node type that the referencing node accepts.
- Every enumerated byte, such as a constant, a symbol, an error constructor, a typed array constructor or a `Temporal` type, has a known value.
- A typed array or `DataView` fits inside its `ArrayBuffer`. A typed array has at most 1,000,000 elements, and a `DataView` at most 1,000,000 bytes.
- An `ArrayBuffer` has at most `maxArrayBufferLength` bytes, 1,000,000 by default.
- An array has a length of at most `maxArrayLength`, 1,000,000 by default.
- A UTF-16 `String` has an even number of bytes.
- A `RegExp` pattern has at most 20,000 characters.
- A `RegExp` or `Temporal` node is only accepted when its feature is enabled. A `Temporal` node also needs the `Temporal` global.
- A container gets no assignments after its `Pending` node, and only one `Pending` node.
- A `Sequence` gets exactly as many `SequencePush` nodes as its `Pending` amount, and its indices are in range.
- A `Promise` gets at most one `PromiseSuccess` or `PromiseFailure`, and does not settle with a `Promise` or any other value that has a `then` method.
- A `Stream` gets no events after its `StreamThrow` or `StreamReturn`.
- When the input ends, no node is cut off, the `Root` has been read, every container has its `Pending` node and all its assignments, and every `Promise` and `Stream` has settled.

When a payload is rejected, the error goes to `onError`, the returned promise is rejected if it has not resolved yet, unsettled promises are rejected and open streams are thrown into.

Some errors are reported through `onError` without rejecting the payload. An assignment that cannot be applied, for example because its value refers to an id with no value or comes from a plugin that failed, is skipped, and decoding continues.

The decoder also guards property keys:

- An `ObjectAssign` key must be a `String` or a `WKSymbol`.
- A symbol key is only applied for `Symbol.iterator`, `Symbol.asyncIterator`, `Symbol.isConcatSpreadable` and `Symbol.toStringTag`. Other symbol keys are ignored.
- The keys `__proto__`, `constructor`, `prototype`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__` and `__lookupSetter__` are defined as own properties instead of assigned.

## Node types

| Type | Node | | Type | Node |
| --- | --- | --- | --- | --- |
| 0 | [`Preamble`](#preamble) | | 21 | [`Error`](#error) |
| 1 | [`Root`](#root) | | 22 | [`Boxed`](#boxed) |
| 2 | [`Constant`](#constant) | | 23 | [`ArrayBuffer`](#arraybuffer) |
| 3 | [`Number`](#number) | | 24 | [`TypedArray`](#typedarray) |
| 4 | [`String`](#string) | | 25 | [`BigIntTypedArray`](#biginttypedarray) |
| 5 | [`BigInt`](#bigint) | | 26 | [`DataView`](#dataview) |
| 6 | [`WKSymbol`](#wksymbol) | | 27 | [`Map`](#map) |
| 7 | [`ObjectAssign`](#objectassign) | | 28 | [`MapSet`](#mapset) |
| 8 | [`ArrayAssign`](#arrayassign) | | 29 | [`Set`](#set) |
| 9 | [`ObjectFlag`](#objectflag) | | 30 | [`SetAdd`](#setadd) |
| 10 | [`Array`](#array) | | 31 | [`Promise`](#promise) |
| 11 | [`Stream`](#stream) | | 32 | [`PromiseSuccess`](#promisesuccess) |
| 12 | [`StreamNext`](#streamnext) | | 33 | [`PromiseFailure`](#promisefailure) |
| 13 | [`StreamThrow`](#streamthrow) | | 34 | [`RegExp`](#regexp) |
| 14 | [`StreamReturn`](#streamreturn) | | 35 | [`AggregateError`](#aggregateerror) |
| 15 | [`Sequence`](#sequence) | | 36 | [`Iterator`](#iterator) |
| 16 | [`SequencePush`](#sequencepush) | | 37 | [`AsyncIterator`](#asynciterator) |
| 17 | [`Plugin`](#plugin) | | 38 | [`Pending`](#pending) |
| 18 | [`Object`](#object) | | 39 | [`Temporal`](#temporal) |
| 19 | [`NullConstructor`](#nullconstructor) | | 40 | [`Reference`](#reference) |
| 20 | [`Date`](#date) | | | |

### Preamble

```text
<byte:preamble=0> <byte:endianness>
```

Tells the decoder how to read the rest of the payload. It holds one value, the byte order of `int`, `uint` and `number` fields:

- `1`: little endian.
- `2`: big endian.

### Root

```text
<byte:root=1> <ref>
```

Names the top-level value. The decoder resolves its result with this value once every container in it is complete.

### Constant

```text
<byte:constant=2> <id> <byte:constant>
```

A value that needs no data:

| Byte | Value |
| --- | --- |
| `0` | `null` |
| `1` | `undefined` |
| `2` | `true` |
| `3` | `false` |
| `4` | `-0` |
| `5` | `Infinity` |
| `6` | `-Infinity` |
| `7` | `NaN` |

### Number

```text
<byte:number=3> <id> <number>
```

A finite number. `-0`, `NaN`, `Infinity` and `-Infinity` are sent as [`Constant`](#constant) nodes instead.

### String

```text
<byte:string=4> <id> <uint:length> <buffer>
```

A string. The top bit of `length` picks the encoding, and the other 31 bits are the number of bytes in `buffer`:

- `0`: UTF-8.
- `1`: UTF-16 code units, 2 bytes each, in the byte order of the `Preamble`. UTF-8 cannot hold a lone surrogate, so the serializer only uses this for a string that has one. The byte count must be even.

### BigInt

```text
<byte:bigint=5> <id> <byte:is-negative> <ref:digits=string>
```

A `bigint`. `is-negative` is `1` for a negative value and `0` otherwise. `digits` holds the absolute value's bytes, most significant first, with each byte stored as one character from `\u0000` to `ÿ`. Like any string, it is sent as UTF-8.

### WKSymbol

```text
<byte:wksymbol=6> <id> <byte:symbol>
```

A well-known symbol:

| Byte | Symbol |
| --- | --- |
| `0` | `Symbol.asyncIterator` |
| `1` | `Symbol.hasInstance` |
| `2` | `Symbol.isConcatSpreadable` |
| `3` | `Symbol.iterator` |
| `4` | `Symbol.match` |
| `5` | `Symbol.matchAll` |
| `6` | `Symbol.replace` |
| `7` | `Symbol.search` |
| `8` | `Symbol.species` |
| `9` | `Symbol.split` |
| `10` | `Symbol.toPrimitive` |
| `11` | `Symbol.toStringTag` |
| `12` | `Symbol.unscopables` |

### ObjectAssign

```text
<byte:object-assign=7> <ref:target=object|null-constructor|error|aggregate-error> <ref:key=string|wksymbol> <ref:value>
```

Sets the property `key` of `target` to `value`. It follows an `Object`, `NullConstructor`, `Error` or `AggregateError` node, after the nodes of `key` and `value`, and before the target's `Pending` node.

The serializer only sends four symbol keys: `Symbol.iterator`, `Symbol.asyncIterator`, `Symbol.isConcatSpreadable` and `Symbol.toStringTag`.

### ArrayAssign

```text
<byte:array-assign=8> <ref:target=array> <uint:index> <ref:value>
```

Sets the element at `index` of `target` to `value`. It follows an `Array` node, before the array's `Pending` node.

### ObjectFlag

```text
<byte:object-flag=9> <ref:target=object|null-constructor|array> <byte:flag>
```

Changes how `target` can be modified:

| Byte | Effect |
| --- | --- |
| `0` | None. |
| `1` | `Object.preventExtensions` |
| `2` | `Object.seal` |
| `3` | `Object.freeze` |

The serializer sends this node only for a target that is not extensible, right after the target's `Pending` node. The decoder applies the flag once the target is complete. It accepts flag `0` and leaves the target unchanged.

### Array

```text
<byte:array=10> <id> <uint:length>
```

Declares an array of `length` elements. `ArrayAssign` nodes set its elements. A hole in a sparse array is never assigned, so `length` can be larger than the number of `ArrayAssign` nodes. The decoder rejects a `length` above `maxArrayLength`.

### Stream

```text
<byte:stream=11> <id> <byte:live>
```

Declares a stream that receives values over time, through `StreamNext`, `StreamThrow` and `StreamReturn` nodes.

`live` is `1` for a [live stream](./streams-and-iterables.md#live-streams) and `0` for a stream from `createStream` or an async iterable. A live stream is decoded as a stream that keeps its values only until the first listener subscribes. After that, it passes values on without storing them, and a second listener throws.

### StreamNext

```text
<byte:stream-next=12> <ref:stream> <ref:value>
```

Sends `value` as the next value of `stream`. A stream can receive any number of these.

### StreamThrow

```text
<byte:stream-throw=13> <ref:stream> <ref:value>
```

Ends `stream` with the error `value`. No more nodes for that stream follow.

### StreamReturn

```text
<byte:stream-return=14> <ref:stream> <ref:value>
```

Ends `stream` with the final value `value`. No more nodes for that stream follow.

### Sequence

```text
<byte:sequence=15> <id> <int:throws-at> <int:done-at>
```

Declares the values an iterable yielded when it was serialized. `SequencePush` nodes add the values, then a `Pending` node gives their count.

- `done-at` is the index of the value the iterator returned with, or `-1`.
- `throws-at` is the index of the value the iterator threw, or `-1`.
- At most one of them is not `-1`.

Both indices must be between `-1` and the count minus 1, and the count must equal the number of `SequencePush` nodes. The decoder rejects a sequence that breaks either rule, because its iterator would never finish.

### SequencePush

```text
<byte:sequence-push=16> <ref:sequence> <ref:value>
```

Adds `value` to `sequence`. It follows a `Sequence` node, before the sequence's `Pending` node.

### Plugin

```text
<byte:plugin=17> <id> <ref:tag=string> <ref:data>
```

A value built by a plugin. `tag` is the plugin's tag, and `data` is what its `binary.serialize` returned. `data` can be any value, not only an object.

The nodes of `data` come before the `Plugin` node. The decoder waits until every container in `data` is complete, then passes it to the `binary.deserialize` of the plugin with the same tag. The value is available once that function returns, or once the promise it returns resolves.

### Object

```text
<byte:object=18> <id>
```

Declares a plain object, `{}`. `ObjectAssign` nodes set its properties. If it is frozen, sealed or not extensible, an `ObjectFlag` node follows its `Pending` node.

A plain object with a `Symbol.iterator` or `Symbol.asyncIterator` method is sent as an `Object`, with an `Iterator` or `AsyncIterator` value for that key. Other iterable objects, such as generators and class instances, are sent the same way as a [`NullConstructor`](#nullconstructor).

### NullConstructor

```text
<byte:null-constructor=19> <id>
```

Declares an object with no prototype, `Object.create(null)`. It works like `Object`.

### Date

```text
<byte:date=20> <id> <number:timestamp>
```

A `Date`, from the number of milliseconds since the Unix epoch, as returned by `getTime()`. An invalid date has a `NaN` timestamp.

### Error

```text
<byte:error=21> <id> <byte:constructor> <ref:message=string>
```

An error with the given constructor and message:

| Byte | Constructor |
| --- | --- |
| `0` | `Error` |
| `1` | `EvalError` |
| `2` | `RangeError` |
| `3` | `ReferenceError` |
| `4` | `SyntaxError` |
| `5` | `TypeError` |
| `6` | `URIError` |

Other properties follow as `ObjectAssign` nodes, then a `Pending` node. These include `stack` when `Feature.ErrorPrototypeStack` is on, `name` when it differs from the constructor's name, and every other own property.

### Boxed

```text
<byte:boxed=22> <id> <ref:value>
```

A boxed primitive, such as `Object(1)` or `Object('text')`, built with `Object(value)`.

### ArrayBuffer

```text
<byte:array-buffer=23> <id> <uint:length> <buffer>
```

An `ArrayBuffer` whose `length` bytes follow as `buffer`. `TypedArray`, `BigIntTypedArray` and `DataView` nodes refer to an `ArrayBuffer` by its id instead of repeating its bytes, so views over the same buffer still share it after decoding.

### TypedArray

```text
<byte:typed-array=24> <id> <byte:constructor> <ref:buffer=array-buffer> <uint:offset> <uint:length>
```

A typed array over `buffer`, starting at `offset` bytes and `length` elements long:

| Byte | Constructor |
| --- | --- |
| `1` | `Int8Array` |
| `2` | `Int16Array` |
| `3` | `Int32Array` |
| `4` | `Uint8Array` |
| `5` | `Uint16Array` |
| `6` | `Uint32Array` |
| `7` | `Uint8ClampedArray` |
| `8` | `Float32Array` |
| `9` | `Float64Array` |

The serializer always sends the whole backing buffer. It rejects a typed array longer than 1,000,000 elements.

### BigIntTypedArray

```text
<byte:bigint-typed-array=25> <id> <byte:constructor> <ref:buffer=array-buffer> <uint:offset> <uint:length>
```

The `bigint` version of `TypedArray`:

| Byte | Constructor |
| --- | --- |
| `1` | `BigInt64Array` |
| `2` | `BigUint64Array` |

It requires `Feature.BigIntTypedArray`. Without it, the serializer does not use this node, and sends the array as an iterable object with no prototype, as the other modes do.

### DataView

```text
<byte:data-view=26> <id> <ref:buffer=array-buffer> <uint:offset> <uint:length>
```

A `DataView` over `buffer`, starting at `offset` bytes and `length` bytes long. The serializer rejects a `DataView` longer than 1,000,000 bytes.

### Map

```text
<byte:map=27> <id>
```

Declares an empty `Map`. `MapSet` nodes add its entries in insertion order.

### MapSet

```text
<byte:map-set=28> <ref:map> <ref:key> <ref:value>
```

Sets `key` to `value` in `map`. It follows a `Map` node, before the map's `Pending` node.

### Set

```text
<byte:set=29> <id>
```

Declares an empty `Set`. `SetAdd` nodes add its values in insertion order.

### SetAdd

```text
<byte:set-add=30> <ref:set> <ref:value>
```

Adds `value` to `set`. It follows a `Set` node, before the set's `Pending` node.

### Promise

```text
<byte:promise=31> <id>
```

Declares a pending promise. One `PromiseSuccess` or `PromiseFailure` node settles it later, often after the `Root` node.

### PromiseSuccess

```text
<byte:promise-success=32> <ref:promise> <ref:value>
```

Resolves `promise` with `value`. The decoder waits until every container in `value` is complete before it resolves the promise.

### PromiseFailure

```text
<byte:promise-failure=33> <ref:promise> <ref:value>
```

Rejects `promise` with `value`.

### RegExp

```text
<byte:regexp=34> <id> <ref:pattern=string> <ref:flags=string>
```

A `RegExp` built from its `source` and `flags`. It requires `Feature.RegExp`. See [Compatibility](./compatibility.md#feature-flags).

### AggregateError

```text
<byte:aggregate-error=35> <id> <ref:message=string>
```

An `AggregateError` with `message`. Its `errors` array and any other properties follow as `ObjectAssign` nodes, then a `Pending` node, as for [`Error`](#error).

It requires `Feature.AggregateError`. Without it, the serializer sends an `AggregateError` as an `Error` node.

### Iterator

```text
<byte:iterator=36> <id> <ref:sequence>
```

A `Symbol.iterator` method that yields the values of `sequence`. The `Sequence` must already have its `Pending` node.

### AsyncIterator

```text
<byte:async-iterator=37> <id> <ref:stream>
```

A `Symbol.asyncIterator` method that yields the values of `stream`.

### Pending

```text
<byte:pending=38> <ref:target> <uint:amount>
```

Closes a container: an `Object`, `NullConstructor`, `Array`, `Map`, `Set`, `Sequence`, `Error` or `AggregateError`. `amount` is the number of assignments the container received, and the decoder uses it to know when the container is complete.

The serializer sends it after the container's assignments. Every container gets exactly one `Pending` node, even with no assignments. An assignment after the `Pending` node, or a second `Pending` node, is malformed.

### Temporal

```text
<byte:temporal=39> <id> <byte:temporal-type> <ref:iso=string>
```

A `Temporal` value, rebuilt with the `from` method of its type and the string from its `toString()`:

| Byte | Type |
| --- | --- |
| `0` | `Temporal.Instant` |
| `1` | `Temporal.Duration` |
| `2` | `Temporal.PlainDate` |
| `3` | `Temporal.PlainDateTime` |
| `4` | `Temporal.PlainMonthDay` |
| `5` | `Temporal.PlainTime` |
| `6` | `Temporal.PlainYearMonth` |
| `7` | `Temporal.ZonedDateTime` |

It requires `Feature.Temporal` and the `Temporal` global on both sides.

### Reference

```text
<byte:reference=40> <id> <ref:key=string>
```

A value registered with [`createReference`](./isomorphic-references.md). Only its key is sent. The receiver must have a value registered under the same key, or the payload is rejected with `SerovalMissingReferenceForIdError`.

## Examples

Each example shows the bytes in hexadecimal for a little-endian payload, so the `Preamble` is `00 01`. A `uint` takes 4 bytes and a `number` 8 bytes.

### null

```text
00 01   02 01 00 00 00 00   01 01 00 00 00
```

| Bytes | Node | Meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | Little endian. |
| `02` `01 00 00 00` `00` | `Constant` | Id `1` is `null`. |
| `01` `01 00 00 00` | `Root` | The root is id `1`. |

### 42

```text
00 01   03 01 00 00 00 00 00 00 00 00 00 45 40   01 01 00 00 00
```

| Bytes | Node | Meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | Little endian. |
| `03` `01 00 00 00` `00 00 00 00 00 00 45 40` | `Number` | Id `1` is `42`, as a little-endian float. |
| `01` `01 00 00 00` | `Root` | The root is id `1`. |

### "hi"

```text
00 01   04 01 00 00 00 02 00 00 00 68 69   01 01 00 00 00
```

| Bytes | Node | Meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | Little endian. |
| `04` `01 00 00 00` `02 00 00 00` `68 69` | `String` | Id `1` is the 2 UTF-8 bytes of `"hi"`. |
| `01` `01 00 00 00` | `Root` | The root is id `1`. |

### { a: 1 }

This shows the whole life of a container: declare it, send its contents, assign them, close it with `Pending`, then name it as the root. The object is extensible, so there is no `ObjectFlag` node.

```text
00 01
12 01 00 00 00
04 02 00 00 00 01 00 00 00 61
03 03 00 00 00 00 00 00 00 00 00 F0 3F
07 01 00 00 00 02 00 00 00 03 00 00 00
26 01 00 00 00 01 00 00 00
01 01 00 00 00
```

| Bytes | Node | Meaning |
| --- | --- | --- |
| `00 01` | `Preamble` | Little endian. |
| `12` `01 00 00 00` | `Object` | Type `18`. Id `1` is `{}`. |
| `04` `02 00 00 00` `01 00 00 00` `61` | `String` | Id `2` is the key `"a"`. |
| `03` `03 00 00 00` `00 00 00 00 00 00 F0 3F` | `Number` | Id `3` is the value `1`. |
| `07` `01 00 00 00` `02 00 00 00` `03 00 00 00` | `ObjectAssign` | Sets key id `2` of id `1` to id `3`. |
| `26` `01 00 00 00` `01 00 00 00` | `Pending` | Type `38`. Id `1` received `1` assignment. |
| `01` `01 00 00 00` | `Root` | The root is id `1`. |

The key and the value are sent as their own nodes before the `ObjectAssign` that refers to them, because a `ref` never points forward.
