---
id: rpc-release-0.1
title: Release @seroval/rpc 0.1.0
status: todo
priority: later
type: release
story: 
early: false
outline: false
milestone: rpc-0.1
target: 
ship: auto
size: S
spike: false
verify: 
exclusive: []
gate: true
owns:
  - .changeset/rpc-release-0.1.md
shared: []
reserves: []
provides: []
depends_on:
  - on: rpc-docs
    kind: hard
    why: ships it
  - on: rpc-transport-release
    kind: hard
    why: rpc depends on the published transport
---
# Release @seroval/rpc 0.1.0

## Goal

Parked until something uses rpc (debate O2, P6, Q1). Then: the manual 0.0.0 publish with a trusted publisher, and a minor changeset to 0.1.0.

## Acceptance

- [ ] `npm view @seroval/rpc@0.1.0 dist.attestations` shows provenance (allow for registry lag).

## Sizing

S: release steps.
