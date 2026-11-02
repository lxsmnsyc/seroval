---
name: rpc-protocol
version: 1
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
  | [3, version: number]                 // hello
  | [4, key: string, n: number]          // credit
  | [5, key: string]                     // cancel, reader to writer; the writer calls writer.cancel(key)
  | [6, channel: number];                // close a channel
```

## Behavior

- Keys are call IDs: `a<id>` for arguments, `r<id>` for results. IDs only increase, even for the initiator and odd for the other side, so a key is never reused.
- A call's argument value is `[name, args]`. `notify` sends no result key.
- Each key has its own refs; rpc never uses `sharedRefs`.
- A channel in a value is a plugin that writes only the channel ID; the endpoint's channel table resolves it.
- `assertMessage` in transport's reader only runs inside `reader.push`, so control types 3 and up never reach it (debate O14).
- After a key settles, the writer drops it from its key set and the reader frees its slot (rpc-transport-fixes).

## Changes

- v1: draft, rewritten after the debate.
