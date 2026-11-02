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
size: M
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
    kind: hard
    why: needs the exported plugin error helper and a built seroval dist with it
  - on: errors-contract
    kind: contract
    via: error-model
---
# Coded errors in seroval-plugins

## Goal

Replace the 14 plain `Error('Expected ...')` throws in `packages/plugins/web` (9 in `validate.ts`, 2 multi-line ones in `abort-signal.ts`, 1 each in `form-data.ts`, `readable-stream.ts`, `image-data.ts`) with a seroval error that carries the plugin tag and what was expected. Export a helper from seroval so third-party plugins can throw the same way.

## Context

- Q3 in `GOAL.md`: wait for `feat/plugin-validate`, which changes the same validators.

## Acceptance

- [ ] No plain `throw new Error(` left in `packages/plugins/web` (`grep -rn -A1 'throw new'`).
- [ ] Plugin tests check `code` and `tag` on a rejected value.
- [ ] Fast check passes.

## Sizing

M: many small edits; coordination with another branch.

## Notes for the worker

- Use `createSerovalPluginError` from `error-model`; errors-base implements it.
