# Log: rpc-spike

- Reset to origin/main (47ca5abb). No packages/rpc there, so the work was not done yet.
- Scaffold copied from packages/transport (it already uses src/ and test/); packages/plugins uses a root index.ts. One entry point only.
- Types written to src/types.ts. Added `Caller`, `ChannelOptions`, `IncomingCall`, `Endpoint`, `MessagePortLike` beside the contract's types.
- Worker example: test/example/{api,worker,search.test}.ts, adapter in test/support/node-port.ts. The worker imports the built package by its own name, because Node cannot load `src` without extensions. tsc resolves it through dist, so build before tsc.
- tsconfig: added allowImportingTsExtensions and noEmit (the worker is a .ts file loaded by Node type stripping).
- Lint: oxlint's type-aware rules wanted a default export for node-port and caught the DOM vs Node `Transferable` mismatch. Fixed; only two `any` warnings remain, in `EndpointOptions.plugins` (copied from the contract).
- Fast check and tsc pass. 1 test runs, 6 are skipped.
