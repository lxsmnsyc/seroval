---
id: errors-contract
title: Error model and catalog
status: done
priority: must
type: contract
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
gate: true
owns:
  - packages/seroval/src/core/error-catalog.ts
  - packages/seroval/test/errors/model.test.ts
shared: []
reserves: []
provides: [error-model]
depends_on: []
---
# Error model and catalog

## Goal

Write `error-catalog.ts` with one entry for every error seroval throws today, including the plain `Error` and `RangeError` throws, and the base `SerovalError` shape. Freeze `error-model`.

## Context

- Today: two numberings (`step` 1-3 and `specific` 1-12) in `packages/seroval/src/core/errors.ts`, no `name` on any class, production messages such as `Seroval Error (step: 3)` that hide the real error in `cause`.
- Plain throws to catalog: `core/stream.ts:58`, `core/constructors.ts:99`, `core/context/deserializer.ts:117` and `:418`, `core/context/stream-parser.ts:485`.
- Q1, Q3 and Q5 are answered in `GOAL.md`.
- Model: brumate `packages/brumate/src/error-catalog.ts`.

## Acceptance

- [x] The catalog has a code for every class in `packages/seroval/src/core/errors.ts` every plain throw listed above, one generic code per step, and the plugin codes (release/1.9.0 had 2 plain plugin throws, mapped to SRV013 and SRV008 by maintainer decision; see outcome).
- [x] `model.test.ts` checks that codes are unique and well formed.
- [x] Development messages in the catalog are stripped from the production build (check the size of `dist` built with `PROD`).
- [x] Fast check passes.

## Sizing

M: design work with the maintainer, small code.
