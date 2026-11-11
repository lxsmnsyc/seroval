# Change request: rpc-protocol v2 to v3

- From node: rpc-streaming
- Status: open

## Problem

`[5, key]` (cancel) says "reader to writer; the writer calls writer.cancel(key)". Keys are numbered per direction, so key "3" of one side's writer and key "3" of the other side's writer are different values. A caller that aborts a signal must cancel a call it wrote (the callee's incoming call key), not a value the receiver wrote. The same message cannot mean both. `[4, key, n]` also leaves `n` and the starting window undefined.

## Proposed change

- `[5, key]`: the reader of `key` leaves it. The receiver is the writer of `key` and calls `writer.cancel(key)`.
- `[5, key, 1]`: the writer of call `key` cancels it. The receiver is the callee, looks `key` up among its incoming calls, aborts `this.signal` and sends no reply.
- `[4, key, n]`: the reader consumed `n` more items (`n` a positive integer) of the streams in the value the receiver wrote under `key`. Only the items of a stream count (seroval `StreamNext` nodes), not other messages.
- The writer starts with `window` items of credit for each key and stops its sources (by holding back the promise that `send` returns) when `window` items are not credited. Both ends should set the same `window`; the default is 16. The reader batches credit: it sends `n` once `max(1, window >> 1)` items were consumed.

## Affected nodes

rpc-generators (two-way generators send `next(value)` back; it can reuse the credit per key), rpc-docs (documents the protocol).

## Workaround in place

Implemented as described in `packages/rpc/src/endpoint.ts` and `packages/rpc/src/streaming/`.

## Decision

<Filled in by the orchestrator.>
