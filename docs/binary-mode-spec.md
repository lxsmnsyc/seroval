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
<byte:object-flag=9> <ref:target=object|null-constructor-array> <byte:flag>
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

### `Stream`

```
<byte:stream=11> <id>
```

A `Stream` represents an observable data that sends and receives value over time.

### `StreamNext`

```
<byte:stream-next=12> <ref:stream> <ref:value>
```

### `StreamThrow`

```
<byte:stream-throw=13> <ref:stream> <ref:value>
```

### `StreamReturn`

```
<byte:stream-return=14> <ref:stream> <ref:value>
```

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
<byte:plugin=17> <id> <ref:tag=string> <ref:config=object>
```

### `Object`

```
<byte:object=18> <id>
```

### `NullConstructor`

```
<byte:null-constructor=19> <id>
```

This node type is for `Object.create(null)`

### `Date`

```
<byte:date=20> <id> <number:timestamp>
```

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

### `TypedArray`

```
<byte:typed-array=24> <id> <byte:constructor> <uint:offset> <uint:length> <ref:array-buffer>
```

`byte:constructor>` is one of the following:

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
<byte:bigint-typed-array=24> <id> <byte:constructor> <uint:offset> <uint:length> <ref:array-buffer>
```

`byte:constructor>` is one of the following:

- `1`: `BigInt64Array`
- `2`: `BigUint64Array`

### `DataView`

```
<byte:data-view=26> <id> <uint:offset> <uint:length> <ref:array-buffer>
```

### `Map`

```
<byte:map=27> <id>
```

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

### `SetAdd`

```
<byte:map-set=30> <ref:set> <<ref:value>
```

`SetAdd` is an action node type that adds a `ref:value` to a `ref:set`
This node type is serialized immediately after a `Set` node has been serialized.

### `Promise`

```
<byte:promise=31> <id>
```

### `PromiseSuccess`

```
<byte:promise-success=32> <ref:promise> <ref:value>
```

### `PromiseFailure`

```
<byte:promise-failure=33> <ref:promise> <ref:value>
```

### `RegExp`

```
<byte:regexp=34> <id> <ref:pattern=string> <ref:flags=string>
```

### `AggregateError`

```
<byte:aggregate-error=35> <id> <ref:message=string>
```

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
