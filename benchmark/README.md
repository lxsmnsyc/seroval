# benchmarks

## Object-key lengths

[Object-key benchmark results and reproduction steps](./object-key-lengths.md) compare the string-codec PR with upstream using actual object properties of 2, 4, 8, 12, 16, and 32 code units.

## Seroval regression reports

These reports compare the bundle size and runtime speed of Seroval revisions. The existing cross-library benchmark below remains separate.

Run from the repository root with Node 22 or later. CI uses pnpm 10.25.0 to read the repository's lockfile. Install workspace dependencies with pnpm, then build the production public exports:

```sh
pnpm --filter seroval --filter seroval-plugins build
pnpm --filter seroval-benchmarks test:reports
pnpm --filter seroval-benchmarks bench:size
pnpm --filter seroval-benchmarks bench:speed
```

The report command resolves `--input`, `--history`, and `--output` from the command's working directory. When running through `pnpm --filter`, use paths relative to `benchmark`, for example:

```sh
pnpm --filter seroval-benchmarks bench:report --input results/reports/size.json
pnpm --filter seroval-benchmarks bench:report --input results/reports/speed.json
```

Results default to `benchmark/results/reports/` (ignored by Git). JSON includes exact source revisions, lockfile hashes, harness hash, scenario manifest, toolchain/runtime/CPU settings, and timing samples. Markdown contains the PR report. Size attribution files contain esbuild metafiles.

For a paired comparison, prepare a second checkout, install its locked dependencies, and build its core and plugins. Point the **same candidate harness** at both checkouts:

```sh
node benchmark/reports/measure.mjs --kind size --baseline /absolute/path/to/baseline --candidate . --output benchmark/results/reports
node benchmark/reports/measure.mjs --kind speed --baseline /absolute/path/to/baseline --candidate . --output benchmark/results/reports
```

Do not run other builds or benchmarks during timing. Omit `--baseline` for an explicit baseline-unavailable report. Use the same checkout for both arguments to measure unchanged-versus-unchanged noise. Both checkouts must have the required public APIs; build or correctness failures fail the run, rather than skip scenarios.

### Bundle size

The fixed production ESM fixtures cover individual core APIs, individual web plugins, all web plugins, and generic JavaScript/JSON encode/decode pairs with and without plugins. The fixtures resolve public package exports and retain named exports; they do not force modules to be side-effect-free.

Each unsplit fixture reports minified raw, gzip, and Brotli bytes. The target is ES2020, gzip level is 9, and Brotli quality is 11. These measurements show the cost of importing Seroval, not package tarball sizes.

### Runtime speed

The workloads cover small objects, large collections, shared references and cycles, short/large/HTML-heavy strings, binary buffers, promises, async iterables, and streaming emission.

- Serialization and JSON encode/decode are separate rows. `toJSON`/`fromJSON` timings do not include `JSON.stringify`/`JSON.parse`.
- Inputs and pre-encoded decode values are prepared outside the clock. Sync and async throughput samples measure calibrated batches and report milliseconds per operation. Async batches use fresh inputs for every operation. Each batch's final output is checked outside the clock.
- Warm JavaScript deserialization reuses the same source text, so V8 can reuse compiled code. Cold collection deserialization runs once per fresh process; its timer excludes startup, module import, and input encoding.
- Async operations are awaited. Streaming first-output measures the initial record, not the first source chunk. Completion measures all emitted records, not receiver decoding.
- Outside the clock, each batch's final result is checked. Stream checks restore all records and check chunk values and order. Graph checks require cycles and shared identities to survive.
- Each sync and async throughput scenario is calibrated separately on both revisions. Batches double until they reach a 50 ms target after at least 250 ms of timed work. Both revisions then use the larger iteration count. Iteration limits and process timeouts fail the run if calibration cannot complete.
- Each warm scenario runs in six independent process pairs, alternating baseline/candidate order. Each process discards at least 250 ms of timed warmup work, then records nine samples. No other scenario runs in that process. Reports use the median of the six process medians, rather than pooling samples across processes.
- Streaming first-output and completion remain latency measurements of one stream, not batch averages. They share a process because both describe the same stream. They use the timed warmup and six paired rounds.
- Cold decoding still uses nine fresh processes per revision with no decode warmup, alternating revision order. Timing runs are sequential, not parallel.

Reports show medians and sample min/max. Time changes use the median of the paired process percentage changes. Cold comparisons pair individual fresh-process samples. A headline change must reach 5% in the same direction in every pair; changes whose median reaches 5% but do not meet that repeatability rule remain in measurement details as **inconclusive**. This rule and range overlap are descriptive, not confidence intervals or statistical significance tests. There are no speed or size regression gates; broken measurements and correctness failures still fail CI.

For a bounded unchanged-code control, select one or more scenarios. Each command still uses the complete calibration and paired-process protocol:

```sh
node benchmark/reports/measure.mjs --kind speed --candidate . --baseline . --scenario object.small.toJSON --scenario string.short.deserialize-warm
```

Selecting either streaming metric includes both. A different scenario set starts a separate history series. Run repeated unchanged-code controls on the intended runner before interpreting small speed differences; the 5% display filter is not a measured noise bound. Protocol version 2 retains batch iteration counts and ordered raw samples in JSON. Older version 1 history remains readable and uses its original pooled median.

### PR comments, history, and dashboards

PR comments and Markdown reports show compact summaries:

- Size rows are hidden only when raw, gzip, and Brotli bytes are all unchanged. Changed rows show the gzip size and byte deltas, sorted by the largest gzip increase. A dash means that metric is unchanged.
- Speed rows show repeatable paired changes of at least 5% in either direction, sorted from time decreases to time increases. Filtering uses unrounded changes. Inconclusive changes remain in collapsed details. Legacy version 1 reports retain the original pooled-median display filter. Times are displayed in microseconds per operation. These filters are for display only, not statistical tests or CI gates.
- Each summary counts hidden rows. Without a baseline, every row remains visible and comparisons are explicitly unavailable.
- Full revisions, measurement time, series ID, and sample ranges for displayed speed rows are in a collapsed **Measurement details** section. Trend columns appear only when compatible history exists.
- JSON artifacts retain all scenarios and measurements, including hidden rows. Raw timing units remain milliseconds. History and dashboards remain unfiltered.

[Measurement CI](../.github/workflows/benchmarks.yml) compares the exact PR base/head revisions. Default-branch pushes compare the previous tip with the new tip. If that baseline cannot be checked out (for example, the old tip is unavailable after a force push), CI warns and measures only the candidate: JSON has a null baseline, and Markdown explicitly says baseline unavailable rather than inventing a comparison. PR baseline checkout failures and all dependency, build, and measurement failures still fail the run. Manual runs compare a revision with itself as a noise control. Toolchain settings and scenario definitions come from the candidate harness for both sides; each revision is built using its own frozen lockfile.

The measurement job has read-only repository permissions and no publication secrets. Its raw results and Markdown reports are retained as workflow artifacts for 30 days.

[The publisher](../.github/workflows/benchmark-publish.yml) runs only code from the trusted default branch. It discovers open PRs using the head repository owner and branch from the GitHub run API, not commit-to-PR associations or the run's PR list (both can be empty for forks). It re-fetches the matching PR and validates JSON, workflow identity, exact candidate/base revisions, head branch, and head/base repositories before updating two bot-owned comments. Fork PRs use this same split; downloaded artifact scripts are never executed. Superseded PR results fail identity validation instead of replacing current comments.

Only successful default-branch push runs enter history. History and generated static pages are committed to the dedicated `benchmark-results` branch. This is independent of artifact expiry. Publication is serialized and reruns replace the same revision/series entry. The latest 200 report records are kept in the current history file; earlier records remain in that branch's Git history.

Changes to harness content, scenario definitions, runtime, compression/build settings, or CPU start a separate series. Each dashboard displays the latest series, with older series still available in raw history. Cross-machine speed trends are not comparable. PR deltas always use the paired baseline, not the latest history point.

**One-time repository setup:** after merging these workflows, enable **Settings → Pages → Source: GitHub Actions** and allow Actions to create PR comments. The publisher needs the declared repository write permissions. The `github-pages` environment must allow deployment from the default branch. No personal token is needed.

If Pages is not enabled, history is still saved and the publisher emits a warning; it does not claim a live dashboard. After enabling Pages, rerun the latest default-branch publisher. The site has `/size/` and `/speed/` pages. The trusted publisher must first exist on the default branch, so this feature's initial PR has artifact/job-summary reports but no automatic comments.

To render a downloaded `history.json` locally:

```sh
node benchmark/reports/report.mjs --history /absolute/path/to/history.json --output benchmark/results/reports/site
```

Open `site/index.html` in a browser. The dashboards are static HTML, with keyboard-accessible tables and raw JSON.

### Extending the reports

Add size fixtures in [config.mjs](./reports/config.mjs). Add runtime fixtures and verification in [runtime.mjs](./reports/runtime.mjs), and update the speed scenario manifest in [results.mjs](./reports/results.mjs). Keep IDs stable unless the workload changes. The producer validates both results against the manifest; missing or duplicate rows and incomplete samples are errors.

Run the report tests, both live commands, and an unchanged paired comparison after changing measurement code. Preserve correctness checks and timing boundaries.

## Libraries

- [`devalue` by Rich Harris](https://github.com/Rich-Harris/devalue)
- [`flatted` by WebReflection (Andrea Giammarchi)](https://github.com/WebReflection/flatted)
- [`next-json` by Daniele Ricci](https://github.com/iccicci/next-json)
- [`oson` by KnorpelSenf](https://github.com/KnorpelSenf/oson)
- [`serialize-javascript` by Yahoo](https://github.com/yahoo/serialize-javascript)
- [`superjson` by BlitzJS](https://github.com/blitz-js/superjson)
- [`tosource` by Marcello Bastéa-Forte](https://github.com/marcello3d/node-tosource)
- [`warp10` by Patrick Steele-Idem](https://github.com/patrick-steele-idem/warp10)
  
## Credits

- [Dylan Piercey](https://github.com/DylanPiercey)
