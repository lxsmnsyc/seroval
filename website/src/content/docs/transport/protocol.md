---
title: Transport message format
description: The messages a @seroval/transport writer sends, and the frames that carry them over bytes.
type: reference
---

## Message format

| Message | Meaning |
| --- | --- |
| `[0, key, data]` | The next piece of a value. The first one for a key starts it. `data` is a `SerovalNode` in JSON format, and code in the code format. |
| `[1, key]` | The value and everything in it settled. |
| `[2, key]` | The writer failed or cancelled the value. |

`toWebStream` sends each message as JSON in a frame: a 12-byte header followed by the UTF-8 data. The header holds the data size as 8 hex digits. `@seroval/transport/frame` exports the encoder and decoder, for other connections that carry bytes.

```text
;0x00000017;[0,"0",{"t":1,"s":"a"}]
```

The header is the one that SolidStart uses for server functions, but the data is a transport message, so a SolidStart reader cannot read these frames.

## Frames

`encodeFrame(message)` returns the header and the data of one frame. Send both, in order. `createFrameDecoder` takes bytes in chunks of any size and passes on each message it completes:

```js
import { createFrameDecoder, encodeFrame } from '@seroval/transport/frame';

// writer side
const writer = createJSONWriter({
  send(message) {
    for (const bytes of encodeFrame(message)) {
      socket.send(bytes);
    }
  },
});

// reader side
socket.binaryType = 'arraybuffer';
const decoder = createFrameDecoder({ onMessage: (message) => reader.push(message) });
socket.onmessage = (event) => decoder.push(new Uint8Array(event.data));
socket.onclose = () => {
  decoder.end();
  reader.end();
};
```

| Option | Description |
| --- | --- |
| `onMessage(message)` | Receives each message, parsed but not checked. `reader.push` checks it. |
| `maxFrameSize` | Refuses any frame larger than this many bytes. Defaults to 64MiB. |

`push` and `end` throw a `SerovalTransportError` on a malformed or oversized frame, and `end` throws when the bytes stop inside a frame. End the reader with that error then.

## Related

- [Transport](../transport.md)
- [Transport reference](./reference.md)
- [RPC message format](../rpc/protocol.md)
