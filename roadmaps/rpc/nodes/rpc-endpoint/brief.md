---
id: rpc-endpoint
title: Endpoint, value calls and postMessage
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
  - packages/rpc/src/endpoint.ts
  - packages/rpc/src/calls.ts
  - packages/rpc/src/channel.ts
  - packages/rpc/src/post-message.ts
  - packages/rpc/src/transfer.ts
  - packages/rpc/test/endpoint/**
shared:
  - packages/rpc/src/index.ts
  - packages/rpc/package.json
  - packages/rpc/tsdown.config.ts
  - packages/rpc/test/example/**
reserves: []
provides: []
depends_on:
  - on: rpc-spike
    kind: hard
    why: builds the types and example the spike wrote
---
# Endpoint, value calls and postMessage

## Goal

The endpoint over one transport writer and reader: `hello` and the version check, calls with `[name, args]`, results, `notify`, call ordering, in-place calls on local channels, `onCall`, `this` as the call context, `RpcRemoteError` with name and message only, and the transport closing with calls in flight. The `@seroval/rpc/post-message` entry for `Worker`, `MessagePort` and `worker_threads`, with the worker's `error` event and the `transfer(value)` marker.

## Acceptance

- [ ] Value calls both ways over an in-memory pair and a `worker_threads` `MessageChannel`.
- [ ] 10,000 sequential calls leave no growing Map or Set in the endpoint.
- [ ] The value-call parts of the worker example run.
- [ ] Fast check passes.

## Sizing

M: transport carries the values, so this is call bookkeeping and one transport.
