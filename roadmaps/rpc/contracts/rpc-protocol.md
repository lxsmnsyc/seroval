---
name: rpc-protocol
version: 4
status: frozen
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
  | [3, version: number, rootId: number | null, window: number] // hello
  | [4, key: string, n: number]          // credit: the reader consumed n more stream items of key
  | [5, key: string]                     // the reader of key leaves it; the writer calls writer.cancel(key)
  | [6, channel: number, side: 0 | 1]    // close a channel: 0 from a holder, 1 from the owner
  | [7, key: string];                    // the writer of call key cancels the call
```

## Behavior

- Every call and every result is sent with `writer.push()`, which keeps no state per key. Keys are the strings `push()` returns; rpc does not name them.
- A call's value is `[channelId, name, args]`. `notify` sends `[channelId, name, args, 1]` and gets no result.
- A result's value is `[callKey, result]`, where `callKey` is the key the call arrived under. A failed call sends `[callKey, { name, message }, 1]`; nothing else of the error crosses. `name` defaults to `'Error'` and `message` to `String(error)`. A result that cannot be serialized is replaced by the failure of its serialization. A call is told from a result by `value[0]`: a number is a channel ID, a string is a call key. A failure named `RpcClosedError` is rebuilt as `RpcClosedError`, any other as `RpcRemoteError`.
- `createChannel` takes the channel's ID from a counter in the module. The ID belongs to the channel for its whole life.
- Each endpoint keeps `owned: Map<id, Channel>` for channels it sent, the served root included, and `remote: Map<id, receiver>` for channels it received. A channel that arrives twice reuses its receiver. The two maps never share entries, so both sides may use the same numbers.
- `owned` refuses a second channel under an ID it already holds and fails that send. This stops two loaded copies of `@seroval/rpc` (CJS and ESM), each with its own counter, from misrouting calls.
- `connect()` returns a receiver at once and holds its calls until hello arrives. A held call whose signal aborted never goes out.
- Every endpoint sends a hello at creation with `rootId` null, and another with the root ID on `serve`. `window` is the sender's reader window (default 16). The version stays 1 until rpc is published.
- A hello with another version fails the endpoint with `RpcTransportError`. So does a hello whose `window` is not a positive safe integer, or a second hello with a root ID.
- A message that is not an array, has an unknown type, or carries a transport key that is not a canonical non-negative integer string fails the endpoint with `RpcTransportError`. So does a call whose `name` is not a string or whose `args` is not an array.
- Each writer uses the window the peer advertised and holds its streams until it knows it. Each reader credits from its own window.
- `[4, key, n]`: the reader consumed `n` more items of the streams in the value the receiver wrote under `key`. Only stream items count (seroval `StreamNext` nodes, `t === 32`). The reader batches credit and sends `n` once `max(1, window >> 1)` items were consumed. Items left unconsumed when a stream ends or is cancelled are never credited. The writer drops the key's credit when the key settles.
- Keys are numbered per direction, so leaving a value and cancelling a call are two messages. `[5, key]` names a value the receiver wrote. `[7, key]` names a call the sender wrote: the callee aborts `this.signal` with an `RpcClosedError`, drops its reader for `key` (which stops the argument streams) and sends no reply. The caller also cancels its writer for `key`.
- A result that arrives for a call no longer pending (cancelled, or its channel closed) is dropped. If it succeeded, the caller also cancels its reader for that key and sends `[5, key]`.
- A cancel for a call that still waits for `serve` is lost. Notify calls cannot be cancelled.
- After `serve`, a call to an ID missing from `owned` fails with `RpcClosedError`, and a notify to one is dropped. Calls that arrive before `serve` wait for it with no bound. Closing the endpoint drops them and sends no reply.
- A close names its side, because both ends may use the same ID: side 0 (a holder closed) is looked up in `owned`, side 1 (the owner closed) in `remote`.
- Closing the root, from either side, closes both endpoints.
- When an endpoint closes while its port is open, it sends `[6, id, 0]` for each channel it holds. It sends no close message for the channels it owns. The peer learns through its port's `onClose`. An endpoint closed by a transport failure or by the port's `onClose` sends nothing.
- Each key has its own refs; rpc never uses `sharedRefs`.
- A channel in a value is the seroval plugin node of tag `@seroval/rpc/Channel` with the shape `{ i }`, where `i` is the serialized channel ID. The endpoint's maps resolve it. It carries no streams.
- A native generator or async generator in a value is the plugin node of tag `@seroval/rpc/Generator`, `{ i }`. `i` is the ID of a hidden channel the sender makes with the functions `next`, `throw` and `return`. Each step is an ordinary call on that channel. The receiver closes it with `[6, id, 0]` once a step is done or fails. The sender's `onClose` calls `generator.return()` without waiting.
- The plugin order on the writer and the reader is the channel plugin, the generator plugin, then `EndpointOptions.plugins`.
- `assertMessage` in transport's reader only runs inside `reader.push`, so control types 3 and up never reach it (debate O14).
- After a key settles, the reader frees its slot (rpc-transport-fixes). rpc calls both `reader.get` and `reader.settled` for each new key.

## Changes

- v1: draft, rewritten after the debate.
- v2: calls and results go through `writer.push()` with transport keys; calls carry the channel ID; channel IDs come from `createChannel` with `owned` and `remote` maps; hello carries the root ID (rpc-spike change request, accepted 2026-11-11).
- v2 (rpc-endpoint, 2026-11-11): string keys from `push()`, the notify flag, the error flag, and the side in the close message, after a review found that `[6, id]` closed the wrong channel when two copies of rpc gave the same ID.
- v3 (rpc-streaming change request, accepted 2026-11-11): hello carries the reader window and a nullable root ID and is sent at creation and on `serve`; credit counts stream items and is batched; `[5, key]` is the reader leaving a value; `[7, key]` cancels a call.
- v4 (rpc-docs, 2026-11-12, frozen): matched to the code. The channel plugin node is `{ i }`, not a bare ID. Closing an endpoint drops the calls that wait for `serve` instead of failing them. Added the generator plugin, the plugin order and the checks that fail the endpoint. The full list is in `nodes/rpc-docs/outcome.md` under Contract differences.
