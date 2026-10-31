# Adversarial review: rpc

Fresh-context reviewer, 2026-10-31. Findings checked against the code before acting.

Accepted:

1. `getCallSignal()` cannot work without AsyncLocalStorage. Replaced by `this.signal` (`CallContext`), Q3 updated.
2. Wrong seroval API: the receiver needs `createCrossDeserializer` (`cross/index.ts:208`), not one-shot `fromCrossJSON`; the two refs maps have opposite types; `onParse(node, initial)` mapping was unstated. `rpc-protocol` now has a callback-to-message table; rpc-contract proves it with a mapping test.
3. No owner for wiring streaming and channels into the endpoint. Added the `rpc-internals` contract (extension interface, fixed extension list with stub files). Streaming and channels now own their own folders and depend on the endpoint with `behavior` edges.
4. Unowned files: `index.ts` and `package.json` exports are created as stubs by rpc-contract; `vitest.config.ts` with a GC project and `vitest run` added; rpc-docs shares `sidebar.ts`; the "changesets per node" claim removed.
5. Streaming and channels shared the close path. `CloseStep` in `rpc-internals` assigns each step.
6. rpc-endpoint could not empty a shared protocol test file. Contract tests are now one file per node.
7. The spike blocked the contract for one question already answered by the code (plugins first, `onParse` returning a promise defers the next record). Spike removed; the remaining check is rpc-contract's mapping test.
8. rpc-worker-example now has `hard` edges; rpc-docs has `behavior` edges to streaming and channels.
- Smaller note, transfer list: `rpc-internals` gives the plugin `state.transferList`.

Rejected: none.
