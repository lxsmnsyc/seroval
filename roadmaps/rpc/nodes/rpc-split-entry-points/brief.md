---
id: rpc-split-entry-points
title: Merge feat/split-entry-points (maintainer)
status: todo
priority: must
type: chore
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
  - roadmaps/rpc/nodes/rpc-split-entry-points/**
shared: []
reserves: []
provides: []
depends_on: []
---
# Merge feat/split-entry-points (maintainer)

## Goal

The maintainer merges `origin/feat/split-entry-points` into main. It adds the `seroval/write` and `seroval/read` entry points that `@seroval/transport` imports (debate O8, step S1).

## Acceptance

- [ ] `packages/seroval/package.json` on main exports `./write` and `./read`.

## Sizing

S: a maintainer merge; no agent work beyond syncing the branch with main if asked.
