---
milestones: [rpc-0.1, rpc-0.2]
run: sequential
review: auto
merge:
  mode: maintainer
branches:
budget:
release:
  publish: changesets
  paths: [packages/rpc/**, packages/transport/**]
  fence: merge
---

# @seroval/rpc

## Outcome

`@seroval/rpc` runs typed calls in both directions between two JavaScript endpoints over a message transport, built on `@seroval/transport`. It holds the channel core of brumate's two-way realtime proposal: `createChannel`, the `Channel` type, an endpoint, streaming arguments and results, a credit window for async iterables, cancelling, channels inside values, two-way generators, and closing from either end. Settled by the debate in `debate/debate.md` (approved 2026-10-31).

## Acceptance

- `pnpm --filter @seroval/rpc test` passes.
- The worker example runs a search index in a `worker_threads` worker with a progress channel back to the caller, cancels a call, drives a two-way generator, and closes the worker from both ends.
- A slow reader holds back a fast producer, and 10,000 sequential calls leave no growing Map or Set in transport or rpc.
- The 0.1.0 release is parked until something uses rpc (Q1 below).

## Priorities

- must: the chain from the prerequisites to the docs node.
- should: improves rpc-0.1 but it can ship without.
- could: when agents are free.
- later: the 0.1.0 release (parked until a consumer exists), rpc-0.2 (WebSocket transport, heartbeat, seroval error codes).

## Constraints

- device: one worktree at a time. Measured load 5 to 9 on 8 cores, about 3 GB of 8 GB free (debate J1, J9).
- time: about 1.5 to 2 weeks of agent time after the maintainer steps, an estimate with no calibration (debate P11). Record actuals in `roadmaps/CALIBRATION.md`.
- tokens: about 8 nodes at 3k to 5k tokens of context each; no node is L (debate P11, J6).
- The core imports only `seroval` and `@seroval/transport`. No brumate imports, no Node-only APIs in the core; transports may use them behind their own entry point.
- `seroval` and `@seroval/transport` are peer dependencies.
- Remote errors carry only `name` and `message`, never stacks or causes.
- A channel ID means nothing outside its endpoint.
- Each node lands on main as its own pull request; nothing stacks on an unmerged branch (debate P12).
- `packages/rpc/src/index.ts` is shared by the chain on purpose: the nodes run one after another on one worktree, so a split buys nothing.

## Non-goals

- rpc's own message layer with no transport dependency (debate O13, rejected by the user in Q5).
- Building the core inside brumate first (debate O7, rejected by the user in Q3).
- A value-only first release (debate A1).
- Closing channels when they are garbage collected (debate P7, O6).
- The `'use socket'` and `'use worker'` directives, the worker loader, reconnection and epochs, the HTTP fallback, auth, rate limits and `getSocket()`. They stay in brumate.
- Passing functions by reference (Cap'n Web style). Channels call by name.

## Verification

- Fast check: `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc test`
- Full check (checkpoints): `pnpm -r build && pnpm -r test`

## Numbered resources

- None.

## Sources

- `debate/debate.md` and `debate/ledger.json`.
- [brumate proposal: Two-way realtime](https://github.com/lxsmnsyc/brumate/blob/main/docs/proposals.md#two-way-realtime) and [Worker functions](https://github.com/lxsmnsyc/brumate/blob/main/docs/proposals.md#worker-functions).
- `origin/feat/transport` (`@seroval/transport`) and `origin/feat/split-entry-points`.

## Coverage

- Channels: `createChannel`, `Channel<T>`, `run`/`close`/`closed`, in-place calls, ordering -> rpc-spike (types), rpc-endpoint
- Channels: channel in an argument or result -> rpc-channels
- Ending a channel: owner and holder close, `onClose` -> rpc-channels; garbage-collected holder -> dropped (Non-goals)
- The connection: socket event, middleware, `getSocket()`, reconnect, epochs, WebSocket over Nitro crossws -> dropped: stays in brumate
- The connection: schema per call and rate limits -> rpc-endpoint (`onCall` middleware hook only)
- Where the channel core lives: core in its own package, brumate re-exports -> this roadmap; re-export -> brumate roadmap
- Inside a channel: messages, per-stream refs, cancel -> transport (rpc-transport-fixes) plus rpc control messages (rpc-endpoint)
- Flow control: window, `credit`, `cancel` -> rpc-streaming
- Ending and cleanups: close order -> rpc-channels; transport close and `error` -> rpc-endpoint
- Cleanups: ping on an interval -> rpc-websocket (heartbeat)
- Over `postMessage`: ordering, worker `error` event, transfer marker -> rpc-endpoint; channel plugin as ID -> rpc-channels
- Additions: `notify`, `onCall`, protocol version, typed errors -> rpc-endpoint; `with({ signal })` and `this.signal` -> rpc-streaming; two-way generators -> rpc-generators

## Open questions

- Q1, answered (debate Q1): no date yet for brumate's consumers, so rpc-release-0.1 is parked.
- Q2, package name (blocks rpc-release-0.1): `@seroval/rpc` needs the `@seroval` npm scope, which `@seroval/transport` sets up first.
- Q3, answered: `channel.with({ signal }).run(...)` on the caller, `this.signal` in the called function. The spike may still change it before the contracts freeze.
- Q4, answered: no WebSocket in rpc-0.1.
- Q5, opt-out for two-way generators (affects rpc-generators). Default: no marker in 0.x; add `stream(generator)` if a fast producer needs the one-way push.
- Q6, seroval 1.8.0 (blocks rpc-transport-release). Transport needs seroval ^1.8.0, and the errors roadmap (`roadmaps/errors`) also plans 1.8.0. Decide what 1.8.0 contains.

## Gates

- rpc-split-entry-points and rpc-transport-release: maintainer steps.
- rpc-spike: the maintainer reads the worker example before the endpoint is built.
- rpc-docs: the contracts freeze here.
