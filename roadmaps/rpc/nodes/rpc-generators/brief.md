---
id: rpc-generators
title: Two-way generators over channels
status: done
priority: must
type: feature
story: 
early: false
outline: false
milestone: rpc-0.1
target: 
ship: auto
size: S
spike: false
verify: 
exclusive: []
gate: false
added: 2026-10-31
owns:
  - packages/rpc/src/generators/**
  - packages/rpc/test/generators/**
shared:
  - packages/rpc/src/index.ts
  - packages/rpc/src/endpoint.ts
  - packages/rpc/test/example/**
reserves: []
provides: []
depends_on:
  - on: rpc-channels
    kind: hard
    why: the generator plugin sends each generator as a channel, so it needs channels in values and the close order
---

# Two-way generators over channels

## Goal

A native generator or async generator in an argument or result becomes a two-way `AsyncGenerator` on the other side. `next(value)`, `throw(error)` and `return(value)` on the receiver run on the real generator and settle with its `{ value, done }`. Other async iterables keep the one-way push with the credit window.

## Context

- Added by the user on 2026-10-31, after the debate settled (`debate/debate.md`, "Scope changes").
- The sender wraps the generator as a hidden channel with the functions `next`, `throw` and `return`. The receiver wraps that channel back into an `AsyncGenerator`. Channel ordering keeps the steps in order, and closing the channel fails a `next` that still waits.
- Detection: `Object.prototype.toString` returns `[object Generator]` or `[object AsyncGenerator]`. A sync generator becomes an `AsyncGenerator` on the other side.
- Each step is a round trip, so no credit window is needed: the reader sets the pace.
- From rpc-streaming: a call is cancelled with `[7, key]` and a reader leaves a value with `[5, key]` (`contracts/rpc-protocol.md` v3). One worker example test (the two-way generator) waits for this node as `it.skip`.
- From rpc-channels (read its outcome): `createChannelPlugin(hooks)` in `src/channels/plugin.ts` writes a channel as its ID, and the endpoint puts it first in the plugin list of its writer and reader. Only channels made by `createChannel` pass its test. Register the generator plugin in `src/endpoint.ts` the same way.
- A channel that is sent but never closed stays in `owned` until the endpoint closes. So the sender must close the hidden channel when the generator finishes, returns or throws, and the receiver must close it on `return()` and on a `break`. Check with `inspectEndpoint(...).owned` that nothing is left.
- seroval sends an async iterable as a one-way stream by default. The generator plugin must take native generators before that path, and must leave other async iterables to it.
- A plugin for an object that is a plain object must not set `skipPlainObjects`.
- Open question Q5 in `GOAL.md`: whether to add a `stream(generator)` marker that forces the one-way push for a fast producer that ignores `next`'s argument.

## Acceptance

- [ ] A generator that reads `const x = yield y` receives the values the other side passes to `next`.
- [ ] `throw(error)` on the receiver throws inside the generator at its `yield`, and the generator can catch it and go on.
- [ ] `return()` and a `break` out of `for await` on the receiver run the generator's `finally`.
- [ ] Closing the channel or the endpoint rejects a pending `next` with `RpcClosedError`.
- [ ] Works in both directions: a generator in arguments and one in a result.
- [ ] Fast check passes.

## Sizing

S: one plugin of about 100 to 150 lines on top of channels, plus tests.
