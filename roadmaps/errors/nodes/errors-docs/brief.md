---
id: errors-docs
title: Docs page per error code
status: todo
priority: must
type: docs
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
  - website/src/content/**/errors/**
  - website/src/content/docs/errors.md
  - website/src/content/sidebar.ts
  - packages/seroval/test/errors/docs.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-contract
    kind: contract
    via: error-model
---
# Docs page per error code

## Goal

Rewrite `website/src/content/docs/errors.md`, which documents the old three-wrapper model, as the index of codes. Add one page per catalog code: what it means, common causes, how to fix it. A test fails when a code has no page.

## Context

- Q2 in `GOAL.md` sets the location.

## Acceptance

- [ ] `docs.test.ts` compares the catalog codes with the pages.
- [ ] `pnpm --filter website build` passes.

## Sizing

M: one short page per code, about 20 codes.
