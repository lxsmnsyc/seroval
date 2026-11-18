---
title: Introduction
description: What seroval is, what it can send, and when to use it.
---

seroval turns a JavaScript value into a string, and turns that string back into the value. It handles the values that `JSON.stringify` loses or rejects.

```js
import { serialize } from 'seroval';

const user = { name: 'Ada', joined: new Date('2026-01-01') };
user.self = user;

serialize(user);
// (h=>(h={name:"Ada",joined:new Date("2026-01-01T00:00:00.000Z")},h.self=h,h))()
```

## Why not JSON?

`JSON.stringify` drops or breaks many common values:

- A `Date` becomes a string, and a `Map` or `Set` becomes `{}`.
- `undefined`, `NaN`, `Infinity` and `-0` are lost or changed.
- A `BigInt` throws.
- A cyclic reference throws, and a shared reference becomes two copies.
- A `Promise` or a stream has no representation at all.

seroval keeps all of these. The value you get back has the same types, the same shared references and the same cycles as the value you sent.

## What seroval can send

- Primitives, including `bigint`, `undefined`, `NaN`, `Infinity` and `-0`.
- Arrays (sparse ones too), plain objects and `Object.create(null)` objects.
- `Date`, `RegExp`, `Map`, `Set`, `Error` and its subclasses, and `AggregateError`.
- `ArrayBuffer`, `DataView` and every typed array.
- Promises, iterables, async iterables and seroval's own streams.
- Well-known symbols such as `Symbol.iterator`.
- Web types such as `URL`, `Headers`, `FormData`, `Request` and `Response`, through [plugins](./using-plugins.md).

The [compatibility page](./compatibility.md) has the full list, with what each mode supports.

## Output formats

seroval can produce four kinds of output:

- **JavaScript.** A self-contained expression that rebuilds the value when it runs. This is the most compact form, and the natural fit for server rendering.
- **JSON.** A tree of plain objects. `fromJSON` rebuilds the value without running any code, so it is safe for input from a client.
- **Cross-reference scripts.** JavaScript that stores values in a shared array, so a later script can refer back to a value an earlier one sent. Streaming uses this form.
- **Binary.** A stream of `Uint8Array` chunks. Like JSON, it is rebuilt without running any code. See [Binary mode](./binary-mode.md).

[Choosing a mode](./choosing-a-mode.md) explains which one to use.

## Who uses it

seroval sends server state to the browser in [SolidJS](https://www.solidjs.com) and in [TanStack Router and Start](https://tanstack.com). If you use one of those frameworks, seroval already runs in your app.

## Next steps

- [Quick start](./quick-start.md): install seroval and send your first value.
- [Playground](/playground): try every mode in the browser.
