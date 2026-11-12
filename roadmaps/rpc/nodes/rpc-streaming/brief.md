---
id: rpc-streaming
title: Credit window and cancelling
status: done
priority: must
type: feature
story: 
early: false
outline: false
milestone: rpc-0.1
target: 
ship: auto
size: M
spike: false
verify: 
exclusive: []
gate: false
owns:
  - packages/rpc/src/streaming/**
  - packages/rpc/test/streaming/**
shared:
  - packages/rpc/src/index.ts
  - packages/rpc/src/endpoint.ts
  - packages/rpc/test/example/**
reserves: []
provides: []
depends_on:
  - on: rpc-endpoint
    kind: hard
    why: adds control messages to the endpoint
---
# Credit window and cancelling

## Goal

Transport's backpressure only holds back the local sender (debate P4). Add the `credit` control message so at most `window` items of an async iterable are in flight across the connection, `cancel` from the reader so the producer's `finally` runs, and `with({ signal })` with `this.signal` on the callee. Signals are `RpcSignal` from `src/signal.ts`, not `AbortSignal` (`contracts/rpc-api.md` v2).

Notes from rpc-endpoint (read its outcome):

- Messages 4 and 5 are ignored by `src/endpoint.ts` today; wire them there. Keys are the strings `writer.push()` returns.
- `with({ signal })` only rejects the caller locally. Send `[5, callKey]` on abort so the callee's `this.signal` aborts too, and the callee's reply after a cancel must not leak a pending entry.
- A failure of a value after its first message (a stream that throws midway) is not reported to the caller. Report it: the reader side of the async iterable must reject.
- `window` in `EndpointOptions` is unused; this node gives it meaning.

## Acceptance

- [ ] A slow reader holds back a fast producer: never more than `window` unread items (debate P8).
- [ ] `break` out of `for await` on the reader runs the producer's `finally`.
- [ ] Aborting a signal rejects `run` and aborts `this.signal` after an `await` on the callee.
- [ ] A stream that throws midway rejects the reader's iteration with `RpcRemoteError`.
- [ ] Fast check passes.

## Sizing

M: the part with no precedent in prior art.
