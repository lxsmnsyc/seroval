---
name: rpc-protocol
version: 2
status: draft
defined_by: rpc-docs
---

# Contract: rpc-protocol

## Purpose

The messages between two endpoints. Transport carries the values; rpc adds a few control messages beside them (debate P10, O14).

## Interface

```ts
// @seroval/transport messages, passed to the transport reader unchanged:
//   [0, key, data]  next record of a value
//   [1, key]        value settled
//   [2, key]        value failed or cancelled by the writer
// rpc control messages, demuxed on message[0] before the reader:
type Control =
  | [3, version: number, rootId: number] // hello, sent by serve(root)
  | [4, key: string, n: number]          // credit
  | [5, key: string]                     // cancel, reader to writer; the writer calls writer.cancel(key)
  | [6, channel: number, side: 0 | 1];   // close a channel: 0 from a holder, 1 from the owner
```

## Behavior

- Every call and every result is sent with `writer.push()`, which keeps no state per key. Keys are the strings `push()` returns; rpc does not name them.
- A call's value is `[channelId, name, args]`. `notify` sends `[channelId, name, args, 1]` and gets no result.
- A result's value is `[callKey, result]`, where `callKey` is the key the call arrived under. A failed call sends `[callKey, { name, message }, 1]`; nothing else of the error crosses. A call is told from a result by `value[0]`: a number is a channel ID, a string is a call key. A failure named `RpcClosedError` is rebuilt as `RpcClosedError`, any other as `RpcRemoteError`.
- `createChannel` takes the channel's ID from a counter in the module. The ID belongs to the channel for its whole life.
- Each endpoint keeps `owned: Map<id, Channel>` for channels it sent and `remote: Map<id, receiver>` for channels it received. A channel that arrives twice reuses its receiver. The two maps never share entries, so both sides may use the same numbers.
- `owned` refuses a second channel under an ID it already holds and fails that send. This stops two loaded copies of `@seroval/rpc` (CJS and ESM), each with its own counter, from misrouting calls.
- `connect()` returns a receiver at once and holds its calls until hello arrives.
- A call to an ID missing from `owned` fails with `RpcClosedError`. Calls that arrive before `serve` wait for it; `endpoint.close` fails them.
- A close names its side, because both ends may use the same ID: side 0 (a holder closed) is looked up in `owned`, side 1 (the owner closed) in `remote`.
- Calls that wait for `serve` are not bounded.
- Each key has its own refs; rpc never uses `sharedRefs`.
- A channel in a value is a plugin that writes only the channel ID; the endpoint's maps resolve it.
- `assertMessage` in transport's reader only runs inside `reader.push`, so control types 3 and up never reach it (debate O14).
- After a key settles, the reader frees its slot (rpc-transport-fixes).

## Changes

- v1: draft, rewritten after the debate.
- v2: calls and results go through `writer.push()` with transport keys; calls carry the channel ID; channel IDs come from `createChannel` with `owned` and `remote` maps; hello carries the root ID (rpc-spike change request, accepted 2026-11-11).
- v2 (rpc-endpoint, 2026-11-11): string keys from `push()`, the notify flag, the error flag, and the side in the close message, after a review found that `[6, id]` closed the wrong channel when two copies of rpc gave the same ID.
