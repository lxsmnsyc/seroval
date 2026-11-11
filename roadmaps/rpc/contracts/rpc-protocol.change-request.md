# Change request: rpc-protocol v1 to v2

- From node: rpc-spike (orchestrator, with the maintainer, 2026-11-11)
- Status: accepted

## Problem

- Keys `a<id>` and `r<id>` go through `writer.write`, which keeps every key in the writer's `written` Set for the writer's life. 10,000 calls grow that Set by 10,000, against the GOAL acceptance.
- A call's value is `[name, args]` with no channel, so a call on a channel that arrived inside a value cannot be routed.
- Channel IDs from an even/odd split per endpoint are not needed once owned channels and remote receivers live in separate maps.

## Proposed change

- Every call and every result is sent with `writer.push()`, which keeps no state per key. Keys are transport's numbers; rpc does not name them.
- A call's value is `[channelId, name, args]`. `notify` uses the same shape and gets no result.
- A result's value is `[callKey, result]`, where `callKey` is the key the call arrived under. A failed call sends `[callKey, error]` with a flag, or a separate tag, decided by rpc-endpoint; only `name` and `message` cross.
- `createChannel` takes the channel's ID from a counter in the module. The ID belongs to the channel for its whole life.
- Each endpoint keeps `owned: Map<id, Channel>` for channels it sent, and `remote: Map<id, receiver>` for channels it received. A channel that arrives twice reuses its receiver. The two maps never share entries, so both sides may use the same numbers.
- `owned` refuses a second channel under an ID it already holds and fails that send. Two loaded copies of `@seroval/rpc` (CJS and ESM) have two counters, and this check stops them from misrouting calls.
- Hello becomes `[3, version, rootId]`. `serve(root)` sends it. `connect()` returns a receiver at once and holds its calls until hello arrives.
- A call to an ID missing from `owned` fails with `RpcClosedError`. Calls that arrive before `serve` wait for it; `endpoint.close` fails them.
- Cancel `[5, key]` keeps its meaning: the reader asks the writer to `writer.cancel(key)`.

## Affected nodes

- rpc-endpoint: calls, results, hello, the two maps.
- rpc-channels: channel plugin writes the ID from `createChannel`; receiver reuse.
- rpc-streaming: credit and cancel refer to transport keys, unchanged in shape.
- rpc-docs: freezes v2.

## Workaround in place

- None needed; no code sends messages yet.

## Decision

- Accepted. The maintainer chose IDs from `createChannel` mapped to a receiver on the other side (2026-11-11), and left the key scheme to the orchestrator.
