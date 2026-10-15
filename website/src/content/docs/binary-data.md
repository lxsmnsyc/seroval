---
title: Binary data
description: How ArrayBuffers and typed arrays are encoded, how to send only a view's bytes, and the JSON size limit.
---

`ArrayBuffer`, `DataView` and every typed array are supported in all modes. A buffer's bytes are encoded as base64, using the fastest encoder the runtime offers.

## Views share their buffer

By default, a typed array or `DataView` is sent with its whole backing `ArrayBuffer`, its byte offset and its length. Views that share a buffer still share it after decoding.

This means a small view can send a much larger buffer, including bytes outside the view:

```js
const big = new ArrayBuffer(512 * 1024);
const view = new Uint8Array(big, 128, 1024);

// Sends all 512 KiB of `big`, not just the 1 KiB the view covers.
serialize(view);
```

## Compact views

Pass `compactArrayBufferViews: true` to send only the bytes each view covers:

```js
import { fromJSON, toJSON } from 'seroval';

const view = new Uint8Array(new ArrayBuffer(512 * 1024), 128, 1024);
const copy = fromJSON(toJSON(view, { compactArrayBufferViews: true }));

copy.byteOffset; // 0
copy.buffer.byteLength; // 1024
```

The option works in every mode, and in `Serializer`. With it:

- Each view gets its own copy of its bytes, even when views overlap.
- Views no longer share a buffer after decoding.
- A view that appears more than once is still decoded as one view.
- A backing `ArrayBuffer` that appears in the value by itself is still sent in full.
- The original values are not changed.

Keep the default when buffer sharing or byte offsets matter to your code.

## JSON decoding limits

`fromJSON` and `fromCrossJSON` reject any `ArrayBuffer` larger than `maxBase64Length` base64 characters. The default is `1000000` characters, about 750 KB of data. The limit protects a receiver from a payload that would make it allocate a huge buffer.

Raise it when you expect larger buffers:

```js
const buffer = new ArrayBuffer(1024 * 1024);
const tree = toJSON(buffer);

// 1 MiB needs 1,398,104 base64 characters.
const copy = fromJSON(tree, { maxBase64Length: 1_398_104 });
```

Details:

- The limit applies to each buffer, not to the whole payload.
- It must be a non-negative safe integer. Zero allows only empty buffers.
- An invalid limit throws a `RangeError` when decoding starts.
- An oversized buffer is rejected before it is decoded. The error is a `SerovalDeserializationError` whose `cause` is a `RangeError`.
- `deserialize` does not use this limit, because it runs JavaScript instead of decoding JSON.
