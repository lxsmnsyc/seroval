---
id: errors-wrapper-message
title: Fix the step wrapper dev message around seroval errors
status: active
priority: must
type: fix
story:
early: false
outline: false
milestone: seroval-1.9
target:
ship: auto
land: auto
size: S
spike: false
verify:
exclusive: []
gate: false
added: 2026-11-24
owns:
  - packages/seroval/src/core/errors.ts
  - packages/seroval/test/errors/wrapper-message.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-base
    kind: hard
    why: fixes the wrapper errors-base built
---

# Fix the step wrapper dev message around seroval errors

## Goal

When a step wrapper (`SerovalParserError`, `SerovalSerializationError`, `SerovalDeserializationError`) wraps a seroval error, its development message must describe the inner error. Today it renders the catalog dev message from its own details, so for SRV001 it reads "The value [object Undefined]...".

## Context

- Source: `roadmaps/errors/inbox.md`, entry of 2026-11-24, found by errors-path (#347) and confirmed by the #347 review.
- The wrapper takes the code and fields of the seroval error it wraps (see `nodes/errors-base/outcome.md`). The fix probably builds the wrapper's dev message from the inner error's message or details.
- errors-path (#347, open) also edits `errors.ts` (path copy, `At $...` suffix). Keep the change small and rebase on whichever lands first.

## Acceptance

- [ ] A test that fails on release/1.9.0 at d86de333 or later: wrapping an SRV001 error (and one other coded error) gives a dev message that names the inner problem, not `[object Undefined]`.
- [ ] Production messages unchanged.
- [ ] Fast check passes.

## Sizing

S: one function and one test.
