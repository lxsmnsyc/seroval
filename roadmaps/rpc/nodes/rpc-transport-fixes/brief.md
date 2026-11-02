---
id: rpc-transport-fixes
title: Rebase @seroval/transport, fix it for rpc, merge it
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
  - packages/transport/**
  - website/src/content/docs/transport.md
  - .changeset/transport-*.md
shared: []
reserves: []
provides: []
depends_on:
  - on: rpc-split-entry-points
    kind: hard
    why: transport imports seroval/write and seroval/read, which only exist after that merge
---
# Rebase @seroval/transport, fix it for rpc, merge it

## Goal

Rebase `origin/feat/transport` on main and add the fixes rpc relies on, then open its pull request (debate P9 step S3, P10, O15).

## Steps

- [ ] Rebase on main after rpc-split-entry-points.
- [ ] The writer deletes a key from its `keys` Set when the value settles (write.ts:77, :109).
- [ ] The reader frees a settled key's slot (read.ts:106; today only `cancel` deletes it, read.ts:183).
- [ ] A way for the reader side to ask the writer to cancel a key, which rpc carries as its control message `[5, key]`.
- [ ] Plugin test cases: a plugin value in a value, in a stream chunk, and after a cancel.
- [ ] A test of 10,000 sequential keys that checks the writer's and reader's Maps and Sets stay bounded.

## Acceptance

- [ ] `pnpm --filter @seroval/transport test` passes with the new tests.
- [ ] The pull request is open against main.

## Sizing

M: a rebase of a 34-file branch plus small fixes and tests.
