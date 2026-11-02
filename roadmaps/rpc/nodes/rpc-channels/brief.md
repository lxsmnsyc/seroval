---
id: rpc-channels
title: Channels in values and close order
status: todo
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

A channel in an argument or result becomes a remote channel, through a plugin that writes only its ID. Either end closes a channel; closing the root closes the endpoint. Run the close order of `rpc-api`. No garbage-collection close (debate P7).

## Acceptance

- [ ] A function returns a new channel per call, and the caller uses it.
- [ ] Closing from either end settles `closed` on both and runs `onClose` once, in order.
- [ ] `run` after close rejects with `RpcClosedError` and causes no unhandled rejection.
- [ ] Fast check passes.

## Sizing

M: ordering rules are specified but subtle.
