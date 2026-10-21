---
title: Plugin security
description: Rules for plugins that decode data from untrusted sources.
---

`fromJSON` and `fromCrossJSON` are built to decode data from untrusted sources, such as a request body from a client. seroval validates its own node types, but it cannot know what a plugin expects. A plugin's `deserialize` method is the one place where untrusted data becomes a live value, so the plugin must validate it.

Treat the `node` given to `deserialize` the same way you treat any request body.

## Validate every value

Every node in the plugin's `node` comes from the sender. When you call `ctx.deserialize(node.field)`, the result can be of any type: a field your serializer always fills with a string can hold a number, an object or another plugin's value in a crafted payload.

A TypeScript cast such as `ctx.deserialize(node.buffer) as ArrayBuffer` checks nothing at runtime. List a validator for each field in `validate`:

```js
import { createPlugin } from 'seroval';
import * as v from 'seroval/validator';

const BlobPlugin = createPlugin({
  // ...
  validate: { buffer: v.arrayBuffer, type: v.string },
  deserialize(node, ctx) {
    return new Blob([ctx.deserialize(node.buffer)], {
      type: ctx.deserialize(node.type),
    });
  },
});
```

When `deserialize` reads a listed field with `ctx.deserialize`, seroval checks the decoded value before returning it. A value that fails throws `SerovalPluginValidationError`, so `deserialize` never gets it. Fields that are not listed, or that `deserialize` never reads, are not checked.

`v` has these validators:

| Validator | Matches |
| --- | --- |
| `v.string`, `v.number`, `v.boolean`, `v.bigint` | A value of that `typeof`. |
| `v.arrayBuffer` | An `ArrayBuffer`. |
| `v.instanceOf(Class)` | An instance of `Class`. |
| `v.optional(validator)` | `undefined`, or a value that matches `validator`. |
| `v.union(...validators)` | A value that matches any of `validators`. |
| `v.array(validator)` | An array whose items all match `validator`. |
| `v.object({ key: validator })` | An object whose listed keys match their validators. Other keys are not checked. |

The validators are also exported as `v` from `seroval`. In a plugin that other people bundle, import them from `seroval/validator` as shown above, so that bundlers can still remove the plugin when it is unused.

A validator is a function that takes a value and returns `true` or `false`, so you can also write your own. For checks that depend on more than one field, check the values by hand in `deserialize`, and throw when they are wrong.

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
- Check every value from `ctx.deserialize` before using it, with `validate` or by hand. Casts are not checks.
- Check identity with `instanceof`, `typeof` and ranges, not marker properties.
- Throw when the payload is not exactly what your plugin produces.
- Never return a function from `deserialize`.
