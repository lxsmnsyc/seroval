---
title: Serialize to JavaScript
description: Turn a value into a JavaScript expression with serialize and serializeAsync, and read it back with deserialize.
---

`serialize` and `serializeAsync` return a JavaScript expression. Running the expression rebuilds the value, with the same types, shared references and cycles.

## serialize

```js
import { serialize } from 'seroval';

serialize({ foo: 'bar' }); // ({foo:"bar"})
```

`serialize` handles synchronous values. It cannot wait, so:

- A promise throws a `SerovalSerializationError`.
- A [stream](./streams-and-iterables.md) or async iterable becomes an empty stream that never ends. Reading it waits forever.

Use `serializeAsync` or a [streaming function](./streaming.md) for those values.

## serializeAsync

`serializeAsync` waits for every promise in the value, and reads every stream and async iterable until it ends. It then returns one string.

```js
import { serializeAsync } from 'seroval';

await serializeAsync(Promise.resolve({ foo: 'bar' }));
// Promise.resolve({foo:"bar"})
```

> [!WARNING]
> `serializeAsync` waits until every stream ends. A stream that never ends makes it wait forever. Use [`crossSerializeStream`](./streaming.md) for long-lived streams.

## deserialize

`deserialize` runs the expression and returns the value.

```js
import { deserialize, serialize } from 'seroval';

const copy = deserialize(serialize(new Map([['a', 1]])));
copy.get('a'); // 1
```

`deserialize` is `eval`. Running output from an untrusted source lets that source run any code. Use the [JSON functions](./json.md) to receive data you do not trust.

In a browser, you usually do not call `deserialize`. You put the output in a `<script>` tag instead:

```js
const html = `<script>window.__DATA__=${serialize(data)}</script>`;
```

The output escapes `</script>` and similar sequences, so it is safe to embed in HTML.

## Shared references

When the same object appears more than once, seroval sends it once. Every place that used it gets the same object back.

```js
const parent = {};

serialize([{ parent }, { parent }]);
// (h=>[{parent:h={}},{parent:h}])()
```

## Cyclic references

An object that refers to itself, directly or through other objects, is rebuilt with the same cycle.

```js
const node = {};
node.self = node;

serialize(node);
// (h=>(h={},h.self=h,h))()
```

This works for cycles through several objects too:

```js
const a = {};
const b = {};
a.next = b;
b.prev = a;

serialize([a, b]);
// ((h,j,k)=>(k=[h={next:j={}},j],j.prev=h,k))()
```

## Options

Both functions take the same options:

| Option | Default | Description |
| --- | --- | --- |
| `plugins` | none | [Plugins](./using-plugins.md) for types seroval does not support itself. |
| `disabledFeatures` | `0` | [Features](./compatibility.md#feature-flags) to turn off, for older runtimes. |
| `depthLimit` | `1000` | How deeply nested a value can be. Deeper values throw `SerovalDepthLimitError`. |
| `compactArrayBufferViews` | `false` | Send only the visible bytes of typed arrays. See [Binary data](./binary-data.md). |

## When a value cannot be serialized

A value seroval does not support, such as a function without a plugin, throws a `SerovalParserError`. Its `cause` is a `SerovalUnsupportedTypeError` that holds the value. See [Errors](./errors.md).

```js
try {
  serialize({ callback: () => {} });
} catch (error) {
  error.cause.value; // the function
}
```

To send a function, register it on both sides with [`createReference`](./isomorphic-references.md).
