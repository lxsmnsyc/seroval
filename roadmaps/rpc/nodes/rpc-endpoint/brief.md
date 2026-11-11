---
id: rpc-endpoint
title: Endpoint, value calls and postMessage
status: active
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
  - packages/rpc/src/node.ts
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

The endpoint over one transport writer and reader: `hello` and the version check, calls, results, `notify`, call ordering, in-place calls on local channels, `onCall`, `this` as the call context, `RpcRemoteError` with name and message only, and the transport closing with calls in flight.

Both contracts are at v2 from the rpc-spike change requests; the port shape and the error flag are yours to decide.

- Calls and results go through `writer.push()`. A call is `[channelId, name, args]`; a result is `[callKey, result]`.
- Channel IDs come from `createChannel`. Keep `owned` and `remote` maps per endpoint. The root ID travels in hello `[3, version, rootId]`, and `connect()` holds calls until it arrives.
- `this.channel` is the channel the call came in on.
- The core imports no Web or Node API. `createEndpoint` takes a runtime-neutral port. `@seroval/rpc/post-message` adapts `Worker`, `MessagePort` and `parentPort`, and owns `transfer(value)` and the worker's `error` event. `@seroval/rpc/node` exports `fromNodeWorker(worker)` for a `worker_threads` `Worker`, which has `on` and no `addEventListener`. Replace `test/support/node-port.ts` with it.

## Acceptance

- [ ] Value calls both ways over an in-memory pair and a `worker_threads` `MessageChannel`.
- [ ] 10,000 sequential calls leave no growing Map or Set in the endpoint.
- [ ] The value-call parts of the worker example run.
- [ ] Fast check passes.

## Sizing

M: transport carries the values, so this is call bookkeeping and one transport.
