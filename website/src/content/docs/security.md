---
title: Security
description: Which functions are safe for untrusted input, and how to use them safely.
---

seroval has two ways to rebuild a value, with very different trust requirements:

- **JavaScript output** is rebuilt by running it. Anyone who controls the output can run any code. Only run output from a sender you trust.
- **JSON output** is rebuilt by `fromJSON` and `fromCrossJSON`, which validate the input and run no code from it. They are built for untrusted input.
- **Binary output** is rebuilt by `binary.deserialize`, which also validates the input and runs no code from it.

## Safe for untrusted input

- `fromJSON`
- `fromCrossJSON`
- `createCrossDeserializer`
- `binary.deserialize`

These reject unknown node types, constructor names and constants. They define reserved property names such as `__proto__` as own properties instead of assigning them. The JSON functions limit nesting with `depthLimit`, and the size of each buffer with [`maxBase64Length`](./binary-data.md#json-decoding-limits).

`binary.deserialize` limits the length of typed arrays and `RegExp` patterns, but not the size of an `ArrayBuffer` or of the whole input. Limit the input size in your transport. Treat any call to its `onError` as a failed payload. See [Untrusted input](./binary-mode.md#untrusted-input).

## Not safe for untrusted input

- `deserialize`, which is `eval`.
- Running any JavaScript output, in a `<script>` tag or otherwise.
- `compileJSON`, which builds JavaScript from a tree without validating it.
- A plugin's `serialize` method, which receives node fields without validation.

`compileJSON` deserves a closer look. It builds code by joining node fields, and assumes the tree came from `toJSON` in a process you control. A tree from an untrusted source can put code into the output through any string field, such as the flags of a `RegExp` node, and that code runs when the output is evaluated.

Keep `compileJSON` on the same side of the trust boundary as the code that produced the tree. To move a value across the boundary, send the JSON and call `fromJSON` on the other side.

## Decoded values come from the sender

`fromJSON` checks that a tree is well formed, and `binary.deserialize` checks the same for its bytes. It does not check whether the values in it are safe for your app. Treat every decoded value as input from the sender, and validate it as you would any request body.

Some values need extra care:

- **RegExp.** A decoded `RegExp` is the sender's pattern. seroval rebuilds it, but never runs it. Running an untrusted pattern can take a very long time if it backtracks, for example `/(a+)+$/`. Only run a decoded `RegExp` if you trust the sender.
- **Features.** The tree says which features the sender used, and a sender can claim all of them. Use `disabledFeatures` to reject the ones you do not need.

If you do not need `RegExp`, disable it, and trees that contain one are rejected:

```js
import { Feature, fromJSON } from 'seroval';

const value = fromJSON(tree, { disabledFeatures: Feature.RegExp });
```

## Plugins

seroval validates its own node types, but a plugin's payload is the plugin's job. A plugin that decodes untrusted data must validate every value it reads, and must never return a function. See [Plugin security](./plugin-security.md).

## Reporting a vulnerability

Do not open a public issue. Follow the [security policy](https://github.com/lxsmnsyc/seroval/blob/main/SECURITY.md).
