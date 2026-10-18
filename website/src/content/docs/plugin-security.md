---
title: Plugin security
description: Rules for plugins that decode data from untrusted sources.
---

`fromJSON` and `fromCrossJSON` are built to decode data from untrusted sources, such as a request body from a client. seroval validates its own node types, but it cannot know what a plugin expects. A plugin's `deserialize` method is the one place where untrusted data becomes a live value, so the plugin must validate it.

Treat the `node` given to `deserialize` the same way you treat any request body.

## Validate every value

Every node in the plugin's `node` comes from the sender. When you call `ctx.deserialize(node.field)`, the result can be of any type: a field your serializer always fills with a string can hold a number, an object or another plugin's value in a crafted payload.

A TypeScript cast such as `ctx.deserialize(node.buffer) as ArrayBuffer` checks nothing at runtime. Check the actual value, and throw when it is wrong:

```js
deserialize(node, ctx) {
  const buffer = ctx.deserialize(node.buffer);
  if (!(buffer instanceof ArrayBuffer)) {
    throw new TypeError('MyPlugin: expected an ArrayBuffer.');
  }
  const type = ctx.deserialize(node.type);
  if (typeof type !== 'string') {
    throw new TypeError('MyPlugin: expected a string.');
  }
  return new Blob([buffer], { type });
}
```

## Check identity, not shape

Use checks that a sender cannot fake: `instanceof`, `typeof`, length and range checks.

Do not decide what a value is from a marker property, such as a `__SOMETHING__` flag, a `then` method or an `on` method. Another plugin can return an object with the same property. When the payload is not exactly what your plugin produces, throw. Do not try to coerce it.

Many platform constructors validate their own input. `new URL(...)`, `new Headers(...)` and `new Response(...)` all throw on bad input, so a plugin built directly on them is safe. Explicit checks matter most when your plugin passes a value to code that later calls a method on it, indexes into it or trusts its structure.

## Never return a function

`deserialize` must not return a function, or an object whose methods do the real work. A function built from untrusted input is something an attacker can make seroval, or your code, call at a time and with arguments they choose. seroval itself calls methods such as `then` and `on` on decoded values.

If your type needs a function at runtime, keep the function inside your plugin's module, and never return it from `deserialize`. A helper plugin that exists only to produce code for the JavaScript output should throw when decoded:

```js
serialize() {
  return MY_INTERNAL_FACTORY.toString();
},
deserialize() {
  throw new Error('MyFactoryPlugin cannot be decoded.');
},
```

## Keep serialize safe

A plugin's `serialize` method also receives the node unchecked. When `compileJSON` runs on a tree from an untrusted source, any string your `serialize` inserts without `ctx.serialize` becomes code. Build the output only from `ctx.serialize` results and fixed strings. See [Security](./security.md).

## Summary

- Treat the `node` given to `deserialize` as untrusted input.
- Check every value from `ctx.deserialize` before using it. Casts are not checks.
- Check identity with `instanceof`, `typeof` and ranges, not marker properties.
- Throw when the payload is not exactly what your plugin produces.
- Never return a function from `deserialize`.
