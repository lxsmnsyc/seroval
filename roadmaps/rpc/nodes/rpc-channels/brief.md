---
id: rpc-channels
title: Channels in values and close order
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
  - packages/rpc/src/channels/**
  - packages/rpc/test/channels/**
shared:
  - packages/rpc/src/index.ts
  - packages/rpc/src/endpoint.ts
  - packages/rpc/test/example/**
reserves: []
provides: []
depends_on:
  - on: rpc-streaming
    kind: hard
    why: the close order stops and fails streams, which rpc-streaming owns
---
# Channels in values and close order

## Goal

A channel in an argument or result becomes a remote channel, through a plugin that writes only the ID `createChannel` gave it (`contracts/rpc-protocol.md` v3). The receiving endpoint reuses one receiver per remote ID, and the owner refuses a second channel under an ID it already holds. Either end closes a channel; closing the root closes the endpoint. Run the close order of `rpc-api`. No garbage-collection close (debate P7).

Notes from rpc-streaming (read its outcome):

- Closing the endpoint already aborts the signals of running calls. The close order must also fail the streams a closed channel still reads or writes, through `src/streaming/`.
- `watchStreams` wraps async iterables only inside arrays, plain objects, maps and sets. A stream inside a plugin value is not wrapped and its producer stalls after `window` items. The channel plugin writes only an ID, so it must not carry streams.
- Three worker example tests wait for this node as `it.skip`: the progress channel and both closes. Turn them on. The two-way generator test stays skipped for rpc-generators.
- Two streams in one value fail with `Malformed node type "4"` on release/1.9.0 (see `inbox.md`). Do not build a test on that shape.
- Count items in tests (`probe.produced` after `settle()`), never milliseconds.

## Acceptance

- [ ] A function returns a new channel per call, and the caller uses it.
- [ ] The same channel sent twice reaches the other side as the same receiver.
- [ ] Closing from either end settles `closed` on both and runs `onClose` once, in order.
- [ ] `run` after close rejects with `RpcClosedError` and causes no unhandled rejection.
- [ ] Fast check passes.

## Sizing

M: ordering rules are specified but subtle.
