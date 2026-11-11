# Change request: rpc-protocol v2 to v3

- From node: rpc-streaming
- Status: accepted

## Problem

`[5, key]` (cancel) says "reader to writer; the writer calls writer.cancel(key)". Keys are numbered per direction, so a caller that aborts a signal cannot name a call it wrote with the same message that names a value the receiver wrote. `[4, key, n]` leaves `n` undefined. The window was assumed equal on both ends, so a mismatch deadlocked a stream (host 2, client 16 stopped after 2 items).

## Proposed change

- Hello is `[3, version, rootId | null, window]`. `window` is the sender's reader window. Every endpoint sends one at creation with `rootId` null, and another with the root ID on `serve`. The protocol version is 2.
- Each writer uses the window the peer advertised, and holds its streams until it knows it. Each reader credits from its own window.
- `[5, key]`: the reader of `key` leaves it. The receiver is the writer of `key` and calls `writer.cancel(key)`.
- `[7, key]`: the writer of call `key` cancels it. The callee aborts `this.signal`, drops its reader for `key` (which stops the argument streams) and sends no reply. The caller also cancels its writer for `key`.
- `[4, key, n]`: the reader consumed `n` more items of the streams in the value the receiver wrote under `key`. Only stream items count (seroval `StreamNext` nodes). Items left unconsumed when a stream ends or is cancelled are never credited; the writer drops the key's credit when the key settles.
- The reader batches credit: it sends `n` once `max(1, window >> 1)` items were consumed. The default window is 16.

## Affected nodes

rpc-generators, rpc-docs.

## Workaround in place

Implemented as described in `packages/rpc/src/endpoint.ts` and `packages/rpc/src/streaming/`.

## Decision

Accepted by the orchestrator, with the call cancel as its own message type `[7, key]` and the window in hello.
