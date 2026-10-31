---
id: errors-release-1.8
title: Release seroval 1.8.0 with the new errors
status: todo
priority: must
type: release
story: 
early: false
outline: false
milestone: seroval-1.8
target: 
ship: auto
size: S
spike: false
verify: 
exclusive: []
gate: true
owns:
  - .changeset/errors-release-1.8.md
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-base
    kind: hard
    why: ships it
  - on: errors-malformed-detail
    kind: hard
    why: ships it
  - on: errors-docs
    kind: hard
    why: production messages link to the pages
---
# Release seroval 1.8.0 with the new errors

## Goal

A minor changeset for seroval, and one for seroval-plugins if errors-plugins landed by then, that says error names and messages changed. Versions are independent since #297, so each package goes to its own next version.

## Acceptance

- [ ] A changeset for seroval, and for seroval-plugins if errors-plugins or `feat/plugin-validate` changed it, with seroval-plugins' peer range matching what it needs (that branch already requires seroval 1.8.0).
- [ ] `npm view seroval@1.8.0 dist.attestations` shows provenance (allow for registry lag).

## Sizing

S: release steps.
