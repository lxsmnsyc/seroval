# Checklist: rpc

- Data and migrations: N/A, no stored data.
- Compatibility: protocol version in `hello` (rpc-protocol); seroval peer range (GOAL constraints). Old workers from a cache close with `RpcTransportError`.
- Auth and permissions: `onCall` middleware hook (rpc-contract). Auth itself stays in brumate.
- Failure modes: remote errors, closed channels, transport close with calls in flight, crashed worker (rpc-endpoint, rpc-channels).
- Concurrency: call ordering per channel, even and odd IDs, close racing a call (rpc-endpoint, rpc-channels).
- Limits: flow-control window for iterables (rpc-streaming). Message size limits of transports: not covered; accept, transports report their own errors.
- Security: remote errors carry name and message only; channel IDs scoped to one endpoint; remote side can call only what it was given (GOAL constraints). Deserializing untrusted messages goes through `fromCrossJSON` with the deserializer's existing limits.
- Observability: not covered in 0.1. Accept: brumate's observability proposal wraps calls through `onCall`.
- Performance: no budget yet. Accept for 0.1; add a benchmark node if brumate's worker functions show a cost.
- Testing: in-memory transport pair, contract tests, `worker_threads` tests, worker example (rpc-contract, rpc-endpoint, rpc-worker-example).
- Local files: N/A, no gitignored inputs.
- Developer experience: types from the other side's functions, README and website page (rpc-contract, rpc-docs), gate on the worker example.
- Rollout: new package at 0.x; brumate opts in.
- Cleanup: "not supported yet" throws for iterables between rpc-endpoint and rpc-streaming; removed by rpc-streaming.
- Coverage: GOAL.md "Coverage".
- Dependencies: none beyond seroval.
