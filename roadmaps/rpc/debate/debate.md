---
goal: Ship @seroval/rpc, a transport-agnostic typed channel core extracted from brumate's two-way realtime proposal, as the base for brumate worker and socket functions
date: 2026-10-31
rounds: 3 of 3
status: approved
roadmap: roadmaps/rpc
supersedes: none
decision: none
---

# Debate: @seroval/rpc

## Settled structure

In the order it ships. The full claims are in `ledger.json`.

1. Prerequisites in seroval, each its own pull request or action (P9, O16):
   - S1, maintainer: merge `feat/split-entry-points` into main. Transport imports `seroval/write` and `seroval/read`, which only that branch adds (O8).
   - S3, agent and maintainer: rebase `feat/transport` on main, add the transport fixes below, and merge it.
   - S2 and S4, maintainer: release seroval 1.8.0, then first-publish `@seroval/transport` at 0.0.0 with a trusted publisher and release it. These gate only the rpc publish, which is parked; rpc builds and merges against the workspace copy of transport once S1 and S3 are on main.
2. Transport fixes, frozen as the surface rpc uses (P10, O15):
   - The writer deletes a key from its `keys` Set when the value settles.
   - The reader frees a settled key's slot, with a test of 10,000 sequential calls that checks the Map and Set sizes.
   - A cancel from the reader reaches the writer. rpc carries it as its own control message.
   - Plugin test cases: a plugin value in a call, in a stream chunk, and after a cancel.
3. rpc on main, one pull request per node, one worktree (P1, P12, J1, J9):
   1. Spike: types and the worker example written against stubs. The contracts stay drafts (P2, O5).
   2. Endpoint: value calls and `notify` over one transport writer and reader per endpoint (P3, P5). Keys are monotonic call IDs, even for the side that opened the transport and odd for the other. rpc tells messages apart by `message[0]`: transport's types 0 to 2 go to the reader unchanged, and rpc's control messages (`hello`, `credit`, `cancel`, `close`) use 3 and up (O14). The method name travels inside the call value as `[name, args]`.
   3. Streaming: the credit window across the connection, which transport's local backpressure does not give (P4), and cancelling. A test shows a slow reader holding back a fast producer (P8).
   4. Channels and close order: a channel in a value is a plugin that writes only its ID, which the endpoint's channel table resolves. Per-key refs only, never `sharedRefs` (P10). Channels close only explicitly; no `FinalizationRegistry` in 0.1 (P7, O6).
   5. Two-way generators: a native generator in a value becomes an `AsyncGenerator` on the other side whose `next`, `throw` and `return` run on the real one, over a hidden channel. Added by the user after the debate.
   6. Docs. The contracts freeze here, after the example runs on real code (P1).
4. Release 0.1.0 is parked until a consumer exists (P6, O2, Q1).

## Budget

- device: one worktree at a time. Measured twice: load 9.4 then 5.0 on 8 cores, 2.7 to 3.2 GB of 8 GB free, 14 GB disk free (J1, J9).
- time: about 1.5 to 2 weeks of agent time after the gates, an estimate with no calibration data (P11, J6). Elapsed time is set by the maintainer steps S1 to S4 (O16).
- tokens: about 6 nodes at 2.9k to 4.8k tokens of context each, plus building and review; no node is L (P11, J6).

## Rejected

- Value-only first cut (A1): with the release parked, it ships to no one. P1 already builds value calls first.
- rpc's own message layer on main with no transport dependency (O13): the user chose to depend on transport after seeing the gated steps (Q5).
- Build inside brumate first (O7): the user chose package first, in seroval (Q3).
- Drop rpc-websocket and rpc-error-codes (O3): they are parked outlines, so dropping them saves nothing.

## Scope changes

- merge rpc-endpoint, rpc-streaming, rpc-channels into one sequential chain; drop the `rpc-internals` contract (O1, P2).
- rpc-contract becomes a spike with draft contracts, and rpc-worker-example moves into it (P2, O5).
- park rpc-release-0.1 (O2, P6).
- add nodes for the prerequisites S1 to S4 and the transport fixes (P9, P10, O15).
- remove the garbage collection test project and `FinalizationRegistry` close (P7, O6).
- add rpc-generators after the channels node: native generators become two-way `AsyncGenerator`s, sent as a hidden channel with `next`, `throw` and `return` (added by the user after the debate settled, 2026-10-31).

## Proofs

- None. Every disputed point was settled by reading the code.

## Prior art

- `@seroval/transport` on `origin/feat/transport`: keyed values, per-value cancel, local backpressure and HTTP frames in 964 lines, 783 of them reusable by rpc (J2, P3).
- Comlink, birpc and Cap'n Web: typed calls over message channels work, birpc at scale in Vitest. None streams async iterables with credit-based flow control, so that part has no precedent (J8, P8). Recalled from their READMEs, not fetched again.

## Open risks

- Transport's API can still change before it is released (O9): accepted, because the transport fixes freeze the surface rpc uses in the same pull request.
- Streaming with credit has no precedent (P8): the spike's slow-reader test is the check.
- The 2-week estimate has no calibration (P11, O12): accepted. Record the actuals in `roadmaps/CALIBRATION.md`.
- seroval 1.8.0 is also the planned release of the errors roadmap (`roadmaps/errors`, errors-release-1.8). Not raised in the debate: decide which work goes into 1.8.0 before S2.

## Answers from the user

- Q1: no date yet for brumate's worker functions or realtime.
- Q2: the future of `feat/transport` depends on what use it is for rpc.
- Q3: package first, in seroval.
- Q4: rpc depends on `@seroval/transport`, which merges and publishes first.
- Q5: still depend on transport after seeing the gated steps and fixes.

## Overruled

- None.

## Cost of this debate

- 3 rounds, about 189k tokens of a 300k budget.
