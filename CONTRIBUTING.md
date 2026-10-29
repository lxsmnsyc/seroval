# Contributing

Thanks for helping with seroval. This guide covers how to set up the repository and what a pull request needs.

## Reporting issues

- Use the [issue forms](https://github.com/lxsmnsyc/seroval/issues/new/choose) for bugs and feature requests.
- Ask questions in [Discussions](https://github.com/lxsmnsyc/seroval/discussions).
- Never report a vulnerability in a public issue. Follow the [security policy](./SECURITY.md) instead.

## Repository layout

- `packages/seroval` is the core library.
- `packages/plugins` is `seroval-plugins`, the plugins for Web APIs such as `Request`, `Blob` and `ReadableStream`.
- `benchmark` holds benchmarks.
- `docs` holds the user documentation.

## Setup

You need Node.js 22 or later and pnpm.

```bash
pnpm install
```

`seroval-plugins` uses the workspace copy of `seroval` through its built `dist` folder. Build `seroval` before running the plugins tests:

```bash
cd packages/seroval
pnpm run build
```

## Running tests

Run the tests from each package folder:

```bash
cd packages/seroval
npx vitest run

cd ../plugins
npx vitest run
```

Rebuild `seroval` after changing it, or the plugins tests will run against the old build.

## Fuzzing

`packages/seroval/fuzz` holds property-based fuzz tests written with [fast-check](https://fast-check.dev). They are not part of `pnpm test` or CI. Run them from the package folder:

```bash
cd packages/seroval
pnpm fuzz
```

- `round-trip.fuzz.ts` generates values with shared references and cycles, sends them through every sync and async mode, and checks that the decoded value has the same shape. It also checks that `serialize` and `crossSerialize` output never contains `</script`, `<!--`, U+2028 or U+2029.
- `untrusted-json.fuzz.ts` changes fields of `toJSON` and `toCrossJSON` output at random and checks that `fromJSON` and `fromCrossJSON` reject bad input with an Error, without overflowing the stack or changing a built-in prototype.

These environment variables control a run:

- `FUZZ_RUNS`: runs per property (default 200).
- `FUZZ_SEED` and `FUZZ_PATH`: replay the failure that fast-check printed.
- `FUZZ_STRICT_ERRORS=1`: also require `fromJSON` and `fromCrossJSON` to throw seroval's own errors, which finds input they do not validate yet.

Turn a failure into a regular test in `test/` before fixing it.

## Linting and formatting

Run both from the repository root:

```bash
pnpm exec oxlint
pnpm exec oxfmt
```

## Pull requests

- Keep each pull request to one change.
- Add tests for new behavior and for every bug fix. A bug fix test should fail without the fix.
- Lint with [oxlint](https://oxc.rs/docs/guide/usage/linter) and format with [oxfmt](https://oxc.rs/docs/guide/usage/formatter). The configuration is in `oxlint.config.ts` and `oxfmt.config.ts`.
- Add a changeset for any change that affects users. Skip it for changes to tests, docs, CI or benchmarks.

```bash
pnpm cs:add
```

Pick `patch` for fixes and `minor` for new features. Write one or two sentences that a user of the package would understand. Describe the visible effect, not the internal change.

## Compatibility

seroval output is often produced by one version and read by another, for example on a server and a client. Keep these rules in mind:

- Do not change the serialized output format or the JSON node format without discussing it first in an issue.
- New node fields must be optional, so older readers can ignore them.
- `fromJSON` and `fromCrossJSON` must stay safe for untrusted input. Validate every node field you read. Do not call methods on values taken from the input.
- `compileJSON` and the JavaScript output of `serialize` are only for trusted input. They do not need the same validation.

## Code of conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md). By taking part, you agree to follow it.
