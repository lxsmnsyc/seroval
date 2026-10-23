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
| `binary` | Takes the value apart and puts it back together for [binary mode](#binary-mode). |
| `validate` | Optional. Validators for the fields of the node, by field name. A listed field is checked when `deserialize` reads it with `ctx.deserialize`. See [Plugin security](./plugin-security.md#validate-every-value). |
| `extends` | Other plugins this plugin needs. They are added automatically. |
| `skipPlainObjects` | Optional. Set it to `true` if `test` never returns `true` for a plain object, whose prototype is `Object.prototype`, such as an object literal. The parsers then do not call `test` for those objects, which makes parsing faster. A plugin that sets it is never applied to such objects. |

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

## Binary mode

[Binary mode](./binary-mode.md) does not use `parse`, `serialize` or `deserialize`. It uses the plugin's `binary` section instead:

- `binary.serialize(value, ctx)` returns data that seroval can send: any value seroval supports, including promises, streams and values from other plugins. seroval serializes that data like any other value, so references and cycles inside it are kept. The data cannot refer back to the value the plugin is serializing.
- `binary.deserialize(data)` receives that data, rebuilt, and returns the value. It may return a promise.

Add a `binary` section to the `Point` plugin:

```js
export const PointPlugin = createPlugin({
  tag: 'my-app/Point',
  // test, parse, serialize and deserialize as above
  binary: {
    serialize(point) {
      return { x: point.x, y: point.y };
    },
    // `v` is `import * as v from 'seroval/validator'`.
    validate: { x: v.number, y: v.number },
    deserialize(data) {
      return new Point(data.x, data.y);
    },
  },
});
```

`binary.deserialize` runs once every object, array, `Map` and `Set` in `data` is filled in. Promises and streams in `data` may still be pending. `data` comes from the sender, so list a validator for each field you use in `binary.validate`. seroval checks those fields before it calls `binary.deserialize`, and throws `SerovalPluginValidationError` if one fails. What a promise in `data` resolves to is only known after you await it, so check that value yourself.

Binary mode also follows `skipPlainObjects`.

Every plugin you pass to binary mode needs a `binary` section. A value that matches a plugin without one makes `binary.serialize` fail with a `TypeError`.

### The binary context

`binary.serialize` gets a context with two methods:

| Method | Description |
| --- | --- |
| `ctx.addCleanup(fn)` | Runs `fn` once serialization ends or is stopped. Use it to release resources the plugin holds. |
| `ctx.streamSource(iterable)` | Turns an async iterable into a seroval stream that can be part of the data. Serialization stops reading it and calls its `return` method when it ends or is stopped. |

This plugin sends a `Countdown` as a stream of numbers. The cleanup stops the timer when serialization is stopped early:

```js
import { createPlugin } from 'seroval';

class Countdown {
  constructor(from) {
    this.from = from;
  }

  async *count(signal) {
    for (let i = this.from; i > 0 && !signal.aborted; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      yield i;
    }
  }
}

export const CountdownPlugin = createPlugin({
  tag: 'my-app/Countdown',
  test(value) {
    return value instanceof Countdown;
  },
  // With no parse functions, the other modes skip this plugin.
  parse: {},
  serialize() {
    throw new TypeError('Countdown only supports binary mode.');
  },
  deserialize() {
    throw new TypeError('Countdown only supports binary mode.');
  },
  binary: {
    serialize(countdown, ctx) {
      const controller = new AbortController();
      ctx.addCleanup(() => controller.abort());
      return {
        values: ctx.streamSource(countdown.count(controller.signal)),
      };
    },
    deserialize(data) {
      // `data.values` is a seroval stream.
      return data.values;
    },
  },
});
```

The receiver gets the stream, and reads it with `on`:

```js
value.countdown.on({
  next(value) {
    console.log(value);
  },
  throw(error) {
    console.error(error);
  },
  return() {
    console.log('done');
  },
});
// 3
// 2
// 1
// done
```

## Rules

- Always parse nested values with `ctx.parse`, never by hand. This keeps references and cycles inside them intact.
- Build the JavaScript output only from `ctx.serialize` results and fixed strings. Never insert a value from the node yourself.
- Validate everything `ctx.deserialize` returns before you use it, with `validate` or by hand. See [Plugin security](./plugin-security.md).
