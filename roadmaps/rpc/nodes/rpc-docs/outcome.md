# Outcome: rpc-docs

## Built

- `website/src/content/docs/rpc.md`: install and peer dependencies, entry points, the worker example as the walkthrough (`api.ts`, `worker.ts`, `main.ts`), channels, the endpoint and its options, ports and both adapters, cancelling with `with({ signal })`, `this.signal` and `createRpcSignal`, streams and the credit window, channels in values, two-way generators, closing and the close order, `onCall`, errors, limits (every note in the brief, plus the ones below), and the message format.
- `packages/rpc/README.md`: install, a short worker example, a list of features, and a link to the docs page.
- `website/src/content/sidebar.ts`: `rpc` after `transport` under Packages.
- `roadmaps/rpc/contracts/rpc-api.md`: v3, `status: frozen`.
- `roadmaps/rpc/contracts/rpc-protocol.md`: v4, `status: frozen`.

Acceptance:

- Every part of the worker example runs, and no `it.skip` is left: holds. The work already existed (rpc-generators removed the last skip); `grep -rn "it.skip" packages/rpc/test` finds nothing.
- README and website page, website build passes: holds.
- Both contracts frozen and matching the exported types: holds.

## Contract differences

The code wins in each case. The contract was changed.

rpc-api (v2 to v3):

1. `createEndpoint(port, options)` had required options. The code has `options: EndpointOptions = {}`, so they are optional.
2. `createEndpoint` returned an anonymous object type. The code returns the exported `Endpoint` interface.
3. `createChannel`'s options, `onCall`'s call argument and `createRpcSignal`'s return were inline types. The code names them `ChannelOptions`, `IncomingCall` and `RpcSignalController`, and exports all three.
4. The error classes were empty. The code gives `RpcClosedError` and `RpcTransportError` an optional message, and `RpcRemoteError` the constructor `(remoteName, message)` and the field `remoteName`.
5. The adapters were comments. The code has `fromMessagePort(source: MessagePortLike): Port` with `MessagePortLike` exported from `@seroval/rpc/post-message`, and `fromNodeWorker(source: Worker | MessagePort): Port`.
6. The exports were not listed. `index.ts` exports `createChannel`, `createEndpoint`, `createRpcSignal`, the three errors, `Port`, and every type of `types.ts` and `signal.ts`. It does not export `PROTOCOL_VERSION`, `inspectEndpoint`, `inspectStreaming` or `MessagePortLike`.
7. `Endpoint.close(reason?)`: the code ignores `reason`. Noted in the contract.
8. Generators: the contract said "a native generator". The code makes every generator and async generator two-way, sync ones included, with no window and no marker. A received generator can be sent on, and the receiver closes the hidden channel.
9. Added behavior the contract did not state:
   - In-place calls skip `onCall` and do not abort the callee's signal.
   - `onCall` sees generator steps.
   - The callee's `this.signal` aborts with `RpcClosedError` on cancel.
   - What `serve` and an invalid `window` throw.
   - Closing the root closes both endpoints.
   - The rejection reason of calls in flight on transport failure and on port close.
10. Close order: the contract left out failing calls in flight, aborting running calls, closing held channels before owned ones, the reverse send order, `onClose` one at a time, and `port.close()`.

rpc-protocol (v3 to v4):

1. "A channel in a value is a plugin that writes only the channel ID": the plugin writes the node `{ i }` under tag `@seroval/rpc/Channel`, where `i` is the serialized ID, not the bare ID.
2. The generator plugin was missing: tag `@seroval/rpc/Generator`, node `{ i }`, a hidden channel with `next`, `throw` and `return`, closed by the receiver with `[6, id, 0]`.
3. The plugin order (channel, generator, user plugins) was missing.
4. "Calls that arrive before `serve` wait for it; `endpoint.close` fails them": the code drops them (`waiting = []`) and sends no reply.
5. "A call to an ID missing from `owned` fails with `RpcClosedError`": only after `serve`, and a notify to one is dropped.
6. `owned` also holds the served root.
7. The checks that fail the endpoint with `RpcTransportError` (version, window, second root hello, malformed message, unknown type, non-canonical key, malformed call) were missing.
8. The close messages on endpoint close were missing: `[6, id, 0]` for held channels while the port is open, none for owned channels, nothing after a transport failure or port close.
9. A late result for a call no longer pending is dropped, and a successful one is left with `[5, key]`.
10. The error defaults (`name` `'Error'`, `message` `String(error)`) and the replacement of a result that cannot be serialized were missing.
11. `[7, key]` aborts the callee's signal with an `RpcClosedError`.

`[7, key]` itself matches the code: callee aborts, drops its reader, sends no reply, and the caller cancels its writer.

## For the maintainer

- `Endpoint.close(reason?: unknown)` accepts a reason and ignores it (`close() { shutdown(new RpcClosedError()) }` in `src/endpoint.ts`). Calls in flight always fail with `RpcClosedError`. Either pass the reason to `shutdown` or drop the parameter from `Endpoint`.
- Closing an endpoint drops the calls that wait for `serve` with no reply. The peer's callers learn only through `Port.onClose`, so over a port without `onClose` (such as `fromMessagePort` on a web `Worker`) they wait forever. This is the same gap as the brief's note on nested channels.
- Two streams in one value (`[g1, g2]`) failed with `Malformed node type "4"` in rpc-streaming, outside rpc. I did not test this again. The docs do not mention it.
- `pnpm --filter website build` in the task matches no project. The package name is `seroval-website`, and its build needs `pnpm --filter seroval-plugins build` first.

## Deviations

- None in owned paths. `packages/rpc/package.json` needs no change: npm always packs `README.md`, whatever `files` says.
- The docs say `@seroval/rpc` is not on npm yet, since the 0.1.0 release is parked.

## Verification

- `pnpm --filter seroval build && pnpm --filter @seroval/transport build && pnpm --filter @seroval/rpc build && pnpm --filter @seroval/rpc test`: pass, 6 files, 87 tests.
- `pnpm --filter seroval-plugins build && pnpm --filter seroval-website build`: pass, `/docs/rpc` prerendered. Every in-page anchor exists in the built HTML.
- `grep -rn "it.skip" packages/rpc/test`: no match.
- Doc samples: the `api.ts`, `worker.ts` and `main.ts` blocks of both docs ran with `node` to the end and passed `tsc` with the package tsconfig. The stream and `onCall` samples were checked with a separate script. All in a temporary folder, removed after.
- `pnpm exec oxlint --no-ignore website/src/content/sidebar.ts`: 0 problems. `oxfmt` on the same file: no change.
- `check_prose.py` on `packages/rpc/README.md` and `website/src/content/docs/rpc.md`: ok.

## Size

- Estimated S, actual S. About 420 lines of docs and 60 changed lines across the two contracts.
