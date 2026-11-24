# Log: rpc-docs

- 2026-11-12: Branch `docs/rpc` reset to `origin/release/1.9.0` at ea23727a.
- Existing work: no `it.skip` in `packages/rpc/test` (rpc-generators removed the last one). No README or website page for rpc yet. `files: ["dist"]` in `packages/rpc/package.json` needs no change, since npm always packs `README.md`.
- Fast check before any edit: 6 files, 87 tests pass.
- Read all of `packages/rpc/src` against both contracts. Differences are listed in `outcome.md`.
- Wrote `website/src/content/docs/rpc.md` with the worker example as the walkthrough, and `packages/rpc/README.md`.
- Checked the doc samples by copying the `api.ts`, `worker.ts` and `main.ts` blocks of both files into a temporary folder in `packages/rpc`. `node main.ts` ran each to the end and exited, and `tsc` with the package tsconfig passed. A second script checked the stream sample (`window: 4` held the producer at 4 items before any read, `break` ran its `finally`) and the `onCall` sample (a throw arrived as `RpcRemoteError`, `remoteName` `Error`). The folder was removed.
- `pnpm --filter website build` matches no project: the website package is `seroval-website`. Its build needs `seroval-plugins` built first (`Could not load ../packages/plugins/dist/dev/web.js` otherwise).
- All in-page anchors of the rpc page exist in the built HTML, and `#message-format` exists on the transport page.
- `check_prose.py` flagged `terminate` once. Fixed.
