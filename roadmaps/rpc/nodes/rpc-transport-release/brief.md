---
id: rpc-transport-release
title: Release seroval 1.8.0 and first-publish @seroval/transport (maintainer)
status: todo
priority: later
type: chore
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
gate: true
owns:
  - .changeset/rpc-transport-release.md
shared: []
reserves: []
provides: []
depends_on:
  - on: rpc-transport-fixes
    kind: hard
    why: publishes the fixed transport
---
# Release seroval 1.8.0 and first-publish @seroval/transport (maintainer)

## Goal

Steps S2 and S4 of the debate: release seroval 1.8.0, then the manual 0.0.0 publish of `@seroval/transport` with a trusted publisher, then its first release. Only the parked rpc release needs it; rpc builds against the workspace copy.

## Context

- Q6 in `GOAL.md`: the errors roadmap also plans seroval 1.8.0.

## Acceptance

- [ ] `npm view @seroval/transport dist.attestations` shows provenance.

## Sizing

S: maintainer release steps.
