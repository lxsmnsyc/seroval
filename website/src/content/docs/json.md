---
title: JSON
description: Send values as a JSON tree that can be decoded without running any code.
---

The JSON functions produce a tree of plain objects instead of JavaScript. `fromJSON` rebuilds the value from the tree without running any code from the sender. This makes the JSON form the right choice whenever the receiver does not trust the sender, such as a server that reads a request body.

```js
import { fromJSON, toJSON } from 'seroval';

const tree = toJSON({ when: new Date('2026-01-01'), ids: new Set([1, 2]) });
const body = JSON.stringify(tree);

const value = fromJSON(JSON.parse(body));
value.ids.has(2); // true
```

## Functions

| Function | Description |
| --- | --- |
| `toJSON(value, options?)` | Returns a tree for a synchronous value. |
| `toJSONAsync(value, options?)` | Waits for promises and streams, then returns a tree. |
| `fromJSON(tree, options?)` | Validates the tree and rebuilds the value. |
| `compileJSON(tree, options?)` | Turns a tree into the JavaScript that `serialize` would produce. |

`toJSON` and `toJSONAsync` take the same options as [`serialize`](./javascript-output.md#options).

The tree has three fields: `t` holds the value, `f` holds the features the sender used, and `m` lists the values that are referenced more than once. Treat the format as opaque. It is meant to be produced by `toJSON` and read by `fromJSON`.

## fromJSON options

| Option | Default | Description |
| --- | --- | --- |
| `plugins` | none | Plugins for the types the sender used. Each one is matched by its tag. |
| `disabledFeatures` | `0` | Features to reject. A tree that uses one is rejected. |
| `depthLimit` | `1000` | How deeply nested the tree can be. |
| `maxBase64Length` | `1000000` | The largest encoded `ArrayBuffer`, in base64 characters. See [Binary data](./binary-data.md#json-decoding-limits). |

The sender's `f` field decides which features the tree may use. `disabledFeatures` is how the receiver turns features off, whatever the sender says. If you do not need `RegExp`, disable it:

```js
import { Feature, fromJSON } from 'seroval';

fromJSON(tree, { disabledFeatures: Feature.RegExp });
```

## compileJSON

`compileJSON` converts a tree into the same JavaScript that `serialize` produces. This lets you build the tree once, then decide later whether to send it as JSON or as JavaScript.

> [!CAUTION]
> `compileJSON` does not validate the tree. A tree from an untrusted source can put code into the output, and that code runs when the output is evaluated. Only compile trees you produced yourself. See [Security](./security.md).

## Cross-reference JSON

`toCrossJSON`, `toCrossJSONAsync` and `toCrossJSONStream` produce the JSON form of the [cross-reference functions](./cross-reference.md). Decode their output with `fromCrossJSON`, or with `createCrossDeserializer` for a stream. See [Streaming](./streaming.md#streaming-json).
