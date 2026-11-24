---
title: RPC message format
description: The messages two @seroval/rpc endpoints exchange.
type: reference
---

This page describes the messages that two `@seroval/rpc` endpoints exchange. You need it only to write an endpoint in another language or to debug a connection.

## Message format

rpc sends the [transport messages](../transport/protocol.md#message-format) `0`, `1` and `2` for values, and these control messages beside them:

| Message | Meaning |
| --- | --- |
| `[3, version, rootId, window]` | Hello. Sent when the endpoint starts with `rootId` `null`, and again on `serve` with the root's ID. `window` is the sender's read window. |
| `[4, key, n]` | Credit. The reader consumed `n` more stream items of the value under `key`. |
| `[5, key]` | The reader left the value under `key`, so the writer stops its sources. |
| `[6, id, side]` | Close the channel `id`. `side` is `0` when a holder closed it and `1` when the owner did. |
| `[7, key]` | The caller cancelled the call under `key`. |

A call is the value `[channelId, name, args]`, with a `1` after them for a notify. A result is `[callKey, value]`, and a failure is `[callKey, { name, message }, 1]`. The protocol version is 1, and an endpoint that receives another version fails with `RpcTransportError`.

## Related

- [RPC](../rpc.md)
- [RPC reference](./reference.md)
- [Transport message format](../transport/protocol.md)
