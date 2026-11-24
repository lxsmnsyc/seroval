---
id: errors-base
title: Base class, names, codes and production messages
status: done
priority: must
type: feature
story: 
early: false
outline: false
milestone: seroval-1.9
target: 
ship: auto
size: M
spike: false
verify: 
exclusive: []
gate: false
owns:
  - packages/seroval/src/core/errors.ts
  - packages/seroval/src/core/stream.ts
  - packages/seroval/src/core/constructors.ts
  - packages/seroval/src/core/context/stream-parser.ts
  - packages/seroval/test/errors/base.test.ts
  - packages/seroval/test/errors/catalog.test.ts
  - packages/seroval/src/index.ts
  - packages/seroval/test/live-receiver.test.ts
  - packages/seroval/test/iterable.test.ts
  - packages/seroval/test/binary.test.ts
  - packages/plugins/tests/web/__snapshots__/**
shared:
  - packages/seroval/src/core/context/deserializer.ts
  - packages/seroval/test/__snapshots__/*
reserves: []
provides: []
depends_on:
  - on: errors-contract
    kind: contract
    via: error-model
---
# Base class, names, codes and production messages

## Goal

Make every class in `packages/seroval/src/core/errors.ts` extend `SerovalError` with its `name`, `code` and fields. Make the step wrappers carry the inner code. Use the `{ cause }` option. Replace the plain throws listed in errors-contract with coded classes.

## Acceptance

- [x] `base.test.ts` throws each existing class and checks `name`, `code`, `instanceof` and the production message.
- [x] No plain `throw new Error(`/`TypeError(` left in `packages/seroval/src`; the `RangeError` at `deserializer.ts:117` carries a `code`. Exception: the serialized `STREAM_CONSTRUCTOR` in `constructors.ts` keeps `throw new Error('Stream consumed')`, because it runs on the client as source text (#342 review).
- [x] `catalog.test.ts` throws every catalog code that seroval itself throws and checks the no-plain-throw grep for `packages/seroval/src`.
- [x] Tests that match message text (`live-receiver.test.ts:69`, `iterable.test.ts:213`, `binary.test.ts:342`, `:364`) are updated, and snapshot changes are only message text.
- [x] `error-catalog.ts` is exported from `shared.ts`, which `src/index.ts` re-exports (`entry-points.test.ts` requires root exports to equal shared plus read and write).
- [x] Fast check passes.

## Sizing

M: one file of classes plus five throw sites and snapshots.

## Notes for the worker

- Starts after `feat/plugin-validate` merges (Q3).
- In `deserializer.ts`, change only the two `RangeError` throws: line 418 becomes the seroval limit error, line 117 stays a `RangeError` with a `code` (Q5). errors-malformed-detail edits the other throw sites in that file and lands after this node.
