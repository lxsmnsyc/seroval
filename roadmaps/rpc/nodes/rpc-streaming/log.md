# Log: rpc-streaming

- Branch feat/rpc-streaming reset to origin/release/1.9.0 (c1049c3d).
- Nothing of the brief existed: `CREDIT` and `CANCEL` were ignored in `src/endpoint.ts`, and `window` was unused.
- Bug proof ("a stream that throws midway"): test `rejects the reader with RpcRemoteError` (now in `test/streaming/streaming.test.ts`), run on c1049c3d with `pnpm --filter @seroval/rpc exec vitest run test/streaming/midway.test.ts` (a copy of the test with its own port helper). Result: failed with `expected TypeError: midway to be an instance of RpcRemoteError`. The failure is reported, but as seroval's rebuilt `TypeError`, not as `RpcRemoteError`. The brief's "not reported" was imprecise; the bug is the wrong error class.
- Seroval's deserialized async iterable buffers every item as it arrives, has no `return`, and its `next()` can throw without a promise. Credit therefore comes from wrapping the iterable (found by walking arrays, plain objects, maps and sets of the value).
- The writer holds the source back with the promise that transport's `send` returns. No transport change.
- `[5, key]` cannot also cancel a call (keys are per direction), so a call cancel is `[5, key, 1]`. Change request written.
- Worker example cancel test aborted before the call left (held until hello), so the callee never saw it. The test now waits one round trip first.
