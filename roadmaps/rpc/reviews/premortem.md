# Premortem: rpc

It is two months from now and rpc-0.1 shipped late or not at all. Why?

1. The API was frozen before anyone used it, and brumate's worker functions needed a different shape (for example, a root channel the worker serves, not one returned from a call). Mitigation: rpc-contract is gated, open question Q1, and rpc-worker-example is a gate before release that writes down every awkward spot.
2. Per-stream refs did not survive nodes arriving as separate messages, because seroval's cross deserializer expects one refs map per scope. Mitigation: rpc-contract runs a mapping test with `createCrossDeserializer` before the protocol freezes.
3. rpc-streaming and rpc-channels both had to edit the endpoint core, and their branches conflicted. Mitigation: the `rpc-internals` contract freezes an extension interface and the close steps; each node owns its own folder.
4. Cleanup order and garbage-collected channels were flaky in CI. Mitigation: rpc-channels records each step in a test, and runs GC-dependent tests in a separate project or skips them with a reason.
5. The first publish stalled on the npm scope and trusted publishing. Mitigation: Q2 in GOAL.md; rpc-release-0.1 checks the scope first. Resolve Q2 early, it is outside the agents' reach.
