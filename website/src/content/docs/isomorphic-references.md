---
title: Isomorphic references
description: Send functions and other values by a shared key with createReference, and hide values with OpaqueReference.
---

Some values cannot be serialized at all, such as functions. If the same value exists on both the sender and the receiver, you can send a key instead, and look the value up on the other side.

## createReference

`createReference(id, value)` registers `value` under the key `id`, and returns `value`. When seroval meets a registered value, it sends the key instead of the value.

```js
import { createReference, serialize } from 'seroval';

const formatPrice = createReference('format-price', price => `$${price}`);

serialize({ formatPrice });
// ({formatPrice:__SEROVAL_REFS__.get("format-price")})
```

Register the same key on the receiving side, in code that runs before the value is decoded. A shared module that both sides import is the simplest way.

```js
// shared.js, imported by the server and the client
import { createReference } from 'seroval';

export const formatPrice = createReference('format-price', price => `$${price}`);
```

Rules:

- The key must be unique, and the same on both sides.
- Only objects, functions and symbols can be registered.
- The value itself is never serialized.
- Decoding a key that was not registered throws `SerovalMissingReferenceForIdError`.

The registry is stored on a global named `__SEROVAL_REFS__`, created the first time you call `createReference`.

## OpaqueReference

`OpaqueReference` sends a stand-in for a value that must not leave the sender, such as a secret or a server-only object.

```js
import { OpaqueReference, serialize } from 'seroval';

serialize({ token: new OpaqueReference('secret', 'hidden') });
// ({token:"hidden"})
```

`new OpaqueReference(value, replacement)` sends `replacement` in place of the whole reference. Without a replacement, it sends `undefined`. The original `value` stays on the sender, available as the `value` property.
