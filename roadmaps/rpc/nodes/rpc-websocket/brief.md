---
id: rpc-websocket
title: WebSocket transport and heartbeat
status: todo
priority: later
type: feature
story: 
early: false
outline: true
milestone: rpc-0.2
target: 
ship: auto
size: L
spike: false
verify: 
exclusive: []
gate: false
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: rpc-release-0.1
    kind: hard
    why: builds on the released core
---
# WebSocket transport and heartbeat

## Goal

A WebSocket entry that stringifies whole messages, and a heartbeat (`ping`/`pong`, close when answers stop) for WebSockets and bare `MessagePort`s.
