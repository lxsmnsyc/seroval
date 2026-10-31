---
id: errors-path
title: Value paths in parse errors
status: todo
priority: should
type: feature
story: 
early: false
outline: false
milestone: 
target: 
ship: auto
size: M
spike: false
verify: 
exclusive: []
gate: false
owns:
  - packages/seroval/src/core/context/sync-parser.ts
  - packages/seroval/src/core/context/async-parser.ts
  - packages/seroval/src/core/context/parser.ts
  - packages/seroval/test/errors/path.test.ts
shared:
  - packages/seroval/src/core/context/stream-parser.ts
reserves: []
provides: []
depends_on:
  - on: errors-path-spike
    kind: hard
    why: the measured cost decides the approach, or drops the node
  - on: errors-base
    kind: hard
    why: edits stream-parser.ts after errors-base changes its throw
---
# Value paths in parse errors

## Goal

Parse errors carry `path`, such as `['users', 3, 'avatar']`, and the development message shows it as `$.users[3].avatar`. Build it the way errors-path-spike recommends.

## Acceptance

- [ ] `path.test.ts` covers objects, arrays, maps, sets and plugin values in all three parsers.
- [ ] perf-pass shows no slowdown above noise on the success path.
- [ ] Fast check passes.

## Sizing

M: three parsers with the same change.
