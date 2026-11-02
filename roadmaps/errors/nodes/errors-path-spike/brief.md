---
id: errors-path-spike
title: Spike: cost of value paths in parse errors
status: todo
priority: should
type: spike
story: 
early: false
outline: false
milestone: 
target: 
ship: auto
size: S
spike: true
verify: 
exclusive: [bench]
gate: true
owns:
  - roadmaps/errors/nodes/errors-path-spike/**
shared: []
reserves: []
provides: []
depends_on:
  - on: errors-contract
    kind: contract
    via: error-model
---
# Spike: cost of value paths in parse errors

## Goal

Measure whether adding the key of each level to an error while it passes up through the parsers (try/catch per level, or another approach) slows the success path. Use the perf-pass skill and the benchmarks in `benchmark/`. Write the numbers and a recommendation to `outcome.md`.

## Acceptance

- [ ] Baseline and prototype numbers for sync, async and stream parsing, with noise.
- [ ] A recommendation: build, build with a different approach, or drop.

## Sizing

S: prototype in a throwaway branch plus benchmark runs.
