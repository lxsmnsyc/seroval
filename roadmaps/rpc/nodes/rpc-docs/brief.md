---
id: rpc-docs
title: Docs and frozen contracts
status: active
priority: must
type: docs
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
gate: true
owns:
  - packages/rpc/README.md
  - website/src/content/docs/rpc.md
  - roadmaps/rpc/contracts/rpc-api.md
  - roadmaps/rpc/contracts/rpc-protocol.md
shared:
  - website/src/content/sidebar.ts
reserves: []
provides: [rpc-api, rpc-protocol]
depends_on:
  - on: rpc-generators
    kind: hard
    why: documents and freezes the API after every feature runs
---
# Docs and frozen contracts

## Goal

Document the package with the worker example as the walkthrough, add the page to the sidebar, and freeze `rpc-api` and `rpc-protocol` to match the code.

Notes from rpc-streaming, to document:

- A result stream the caller never iterates keeps its producer and gate key until the endpoint closes. Iterate it, `return()` it, or abort the call.
- Streams are wrapped only inside arrays, plain objects, maps and sets. A stream inside a class instance or a plugin value stalls after `window` items.
- A cancel for a call that still waits for `serve` is lost, and notify calls cannot be cancelled.
- The window relies on seroval's node type 32 (`StreamNext`), which seroval does not export.

Notes from rpc-channels, to document:

- A channel sent but never closed stays in `owned` until the endpoint closes. Close it from either end.
- A channel received from the other side cannot be sent back to it. Only channels made by `createChannel` cross.
- A call to an ID missing from `owned` on an endpoint that never called `serve` waits for `serve`.
- The close order, and that a throwing `onClose` is reported as an unhandled rejection while the rest run.

Notes from rpc-generators, to document:

- Every native generator or async generator in a value is two-way: one round trip per step and no credit window. A plain async iterable (an object with `Symbol.asyncIterator`) is the way to get the one-way push with the window. There is no `stream(generator)` marker (Q5).
- The receiver closes the hidden channel once a step is done or fails. A receiver that drops the generator without `return()` leaves that channel in `owned` until the endpoint closes.
- A received generator can be sent on. Each hop adds a hidden channel and a round trip per step.
- Closing an endpoint sends no close message for nested channels. The peer learns through `Port.onClose`, so a port without `onClose` leaves a pending `next` waiting.

Decided by the orchestrator (2026-11-12):

- The queue of calls that wait for `serve` stays unbounded in rpc-0.1. Document it as a limit. The bound stays in `inbox.md`.
- This node edits and freezes both contracts, as their `defined_by` says. Where a contract and the code differ, the code wins: change the contract and list each difference in the outcome. A difference that looks like a bug in the code goes in the outcome under "For the maintainer", with no code change.

## Acceptance

- [ ] Every part of the worker example runs; no `it.skip` left.
- [ ] README and website page; `pnpm --filter website build` passes.
- [ ] Both contracts set to `frozen` and match the exported types.

## Sizing

S: docs and a contract review.
