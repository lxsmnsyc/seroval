---
id: errors-malformed-detail
title: Say what was malformed
status: todo
priority: must
type: feature
story: 
early: false
outline: false
milestone: seroval-1.8
target: 
ship: auto
size: M
spike: false
verify: 
exclusive: []
gate: false
owns:
  - packages/seroval/src/core/context/serializer.ts
  - packages/seroval/src/core/context/deserializer.ts
  - packages/seroval/src/core/cross/**
  - packages/seroval/src/core/tree/**
  - packages/seroval/test/errors/malformed.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-base
    kind: hard
    why: edits deserializer.ts throw sites next to the lines errors-base changes, and needs the detail argument in the constructors
---
# Say what was malformed

## Goal

The 15 `SerovalMalformedNodeError` sites (all in `deserializer.ts`) and 8 `SerovalUnsupportedNodeError` sites (5 in `serializer.ts`, 3 in `deserializer.ts`) each pass a `detail` (which field, what was expected) and the node ID, so a development message reads like `Malformed node 12 (type 6): flags must be a string`.

## Acceptance

- [ ] `malformed.test.ts` feeds a broken node to each throw site and checks its detail.
- [ ] Production messages unchanged in format.
- [ ] Fast check passes.

## Sizing

M: many small edits across the deserializer and serializer.
