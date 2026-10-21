---
title: Writing plugins
description: Add support for your own types with createPlugin.
---

A plugin tells seroval how to take a value apart into nodes, and how to put it back together. This page builds a plugin for a `Point` class.

```js
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}
```

## A complete plugin

```js
import { createPlugin } from 'seroval';

export const PointPlugin = createPlugin({
  tag: 'my-app/Point',
  test(value) {
    return value instanceof Point;
  },
  parse: {
    sync(point, ctx) {
      return { x: ctx.parse(point.x), y: ctx.parse(point.y) };
    },
    async async(point, ctx) {
      return { x: await ctx.parse(point.x), y: await ctx.parse(point.y) };
    },
    stream(point, ctx) {
      return { x: ctx.parse(point.x), y: ctx.parse(point.y) };
    },
  },
  serialize(node, ctx) {
    return `new Point(${ctx.serialize(node.x)},${ctx.serialize(node.y)})`;
  },
  deserialize(node, ctx) {
    const x = ctx.deserialize(node.x);
    const y = ctx.deserialize(node.y);
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new TypeError('Point: expected two numbers.');
    }
    return new Point(x, y);
  },
});
```

Use it like any other plugin:

```js
serialize(new Point(1, 2), { plugins: [PointPlugin] });
// new Point(1,2)
```

The JavaScript output calls `new Point`, so `Point` must be in scope wherever the output runs.

## Fields

| Field | Description |
| --- | --- |
| `tag` | A unique name for the plugin. It is written into the output, and the receiver picks its plugin by it. Prefix it with your package name. |
| `test(value)` | Returns `true` for the values this plugin handles. |
| `parse.sync` | Takes the value apart for `serialize`, `toJSON`, `crossSerialize` and `toCrossJSON`. |
| `parse.async` | Takes the value apart for the async functions. May return a promise. |
| `parse.stream` | Takes the value apart for the streaming functions and `Serializer`. |
| `serialize(node, ctx)` | Returns a JavaScript expression that rebuilds the value. Used by the JavaScript output and `compileJSON`. |
| `deserialize(node, ctx)` | Rebuilds the value from its node. Used by `fromJSON`, `fromCrossJSON` and `createCrossDeserializer`. |
| `extends` | Other plugins this plugin needs. They are added automatically. |
| `skipPlainObjects` | Optional. Set it to `true` if `test` never returns `true` for an object whose `constructor` is `Object`, such as an object literal. The parsers then do not call `test` for those objects, which makes parsing faster. A plugin that sets it is never applied to such objects. |

Each `parse` function returns an object of nodes. That object is the `node` that `serialize` and `deserialize` receive.

A plugin that leaves out a `parse` function is skipped in that mode, and the value is handled as if the plugin did not exist. That is how a plugin can support only the async functions.

## Context methods

Each function gets a context to process nested values:

| Context | Method | Description |
| --- | --- | --- |
| parse (all modes) | `ctx.parse(value)` | Turns a nested value into a node. Returns a promise in `parse.async`. |
| `parse.async` | `ctx.parseStreamSource(iterable)` | Reads an async iterable into a stream node. |
| `parse.stream` | `ctx.parseStreamSource(iterable)` | Sends an async iterable as a live stream, value by value. |
| `serialize` | `ctx.serialize(node)` | Returns the JavaScript expression for a nested node. |
| `deserialize` | `ctx.deserialize(node)` | Rebuilds a nested node. |

`parse.stream` also gets `ctx.addCleanup(fn)`, which runs `fn` when the stream ends or is stopped. Use it to release resources the plugin holds.

## Rules

- Always parse nested values with `ctx.parse`, never by hand. This keeps references and cycles inside them intact.
- Build the JavaScript output only from `ctx.serialize` results and fixed strings. Never insert a value from the node yourself.
- Validate everything `ctx.deserialize` returns before you use it. See [Plugin security](./plugin-security.md).
