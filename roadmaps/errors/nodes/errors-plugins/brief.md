---
id: errors-plugins
title: Coded errors in seroval-plugins
status: todo
priority: should
type: feature
story: 
early: false
outline: false
milestone: 
target: 
ship: auto
size: S
spike: false
verify: 
exclusive: []
gate: false
owns:
  - packages/plugins/web/**
  - packages/plugins/tests/web/**
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-base
    kind: behavior
    via: error-model
  - on: errors-contract
    kind: contract
    via: error-model
---
# Coded errors in seroval-plugins

## Goal

Replace the plain throws left in `packages/plugins/web` with existing seroval errors. Since seroval 1.8.0 the validators throw `SerovalPluginValidationError`, so 2 remain:

- `validate.ts` `claim()` ("Expected a value used by one plugin value only."): throw `SerovalPluginValidationError(tag, field)` (SRV013). `claim()` has no tag today; pass it from the callers, or catch and rethrow with it at the deserialize sites.
- `abort-signal.ts` `AbortControllerFactoryPlugin.deserialize`: throw `SerovalMalformedNodeError` (SRV008).

No new code and no new helper (contract `error-model`, maintainer decision 2026-11-09). seroval-plugins keeps its `seroval: ^1.8.0` peer range.

## Context

- Q3 in `GOAL.md`: wait for `feat/plugin-validate`, which changes the same validators.

## Acceptance

- [ ] No plain `throw new Error(` left in `packages/plugins/web` (`grep -rn -A1 'throw new'`).
- [ ] Plugin tests check `code` (and `tag` for SRV013) on both throws.
- [ ] The `seroval` peer range in `packages/plugins/package.json` stays `^1.8.0`.
- [ ] Fast check passes.

## Sizing

S: two throw sites and their tests.

## Notes for the worker

- Both classes already exist in seroval 1.8.0; errors-base gives them their `code`. Code tests need errors-base, the class swap does not.
