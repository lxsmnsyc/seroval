---
id: errors-remove-deprecated
title: Remove deprecated error exports
status: todo
priority: later
type: refactor
story: 
early: false
outline: true
milestone: seroval-2.0
target: 
ship: auto
size: S
spike: false
verify: 
exclusive: []
gate: false
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-release-1.9
    kind: hard
    why: removal belongs to the next major
---
# Remove deprecated error exports

## Goal

Remove `SerovalMissingReferenceError`, which seroval no longer throws, and any compatibility shims errors-base kept.
