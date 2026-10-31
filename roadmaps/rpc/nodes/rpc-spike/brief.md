---
id: rpc-spike
title: Package scaffold, draft types and the worker example
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
gate: true
owns:
  - packages/rpc/package.json
  - packages/rpc/tsconfig.json
  - packages/rpc/tsdown.config.ts
  - packages/rpc/vitest.config.ts
  - packages/rpc/src/types.ts
  - packages/rpc/src/errors.ts
  - packages/rpc/test/example/**
  - packages/rpc/test/support/**
shared:
  - packages/rpc/src/index.ts
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: rpc-transport-fixes
    kind: hard
    why: rpc depends on the workspace copy of the fixed transport
---
# Package scaffold, draft types and the worker example

## Goal

Create `packages/rpc` as `@seroval/rpc` at 0.0.0, depending on `seroval` and `@seroval/transport` from the workspace. Write the draft types of `rpc-api` and the worker example first, against stubs, so the maintainer can judge the API before the endpoint is built (debate P1, P2, O5).

## Context

- Copy the setup of `packages/plugins`, but with `src/` and `test/`, and `"test": "vitest run"`.
- The worker example: a search index in a `worker_threads` worker, a progress channel from the caller, `run('query')`, a cancelled call, a two-way generator, closing from both ends. Mark the parts that need later nodes as `it.skip` with the node id.

## Acceptance

- [ ] `pnpm --filter @seroval/rpc build` passes.
- [ ] The example compiles against the types; `outcome.md` lists every place the API felt awkward.

## Sizing

M: boilerplate plus types and one example; API shape is the uncertain part.
