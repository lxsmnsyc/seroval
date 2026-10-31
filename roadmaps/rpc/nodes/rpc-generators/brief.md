---
id: rpc-generators
title: Two-way generators over channels
status: todo
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
