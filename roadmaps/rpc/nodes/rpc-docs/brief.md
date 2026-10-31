---
id: rpc-docs
title: Docs and frozen contracts
status: todo
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

## Acceptance

- [ ] Every part of the worker example runs; no `it.skip` left.
- [ ] README and website page; `pnpm --filter website build` passes.
- [ ] Both contracts set to `frozen` and match the exported types.

## Sizing

S: docs and a contract review.
